import { Router, Response } from 'express';
import { query, transaction } from '../db';
import { authenticateParent, authenticateStaff, AuthenticatedRequest, requireRoles } from '../security';
import { logAudit } from '../utils/auditLogger';
import { encryptText, decryptText } from '../utils/crypto';
import { aiQueue } from '../utils/aiQueue';
import { calculateParentTrust } from '../services/trustScore';

const router = Router();

/**
 * @route   POST /api/v1/complaints
 * @desc    Submit a new ad hoc complaint (Parent)
 * @access  Private (Parent Session)
 */
router.post('/', authenticateParent, async (req: AuthenticatedRequest, res: Response) => {
    const parentId = req.parent?.parentId;
    const { schoolId, text, photoUrl, isFullyAnonymous } = req.body;

    if (!schoolId || !text) {
        return res.status(400).json({ error_code: 'BAD_REQUEST', message: 'schoolId and text are required' });
    }

    if (text.length < 20 || text.length > 2000) {
        return res.status(400).json({ 
            error_code: 'INVALID_TEXT_LENGTH', 
            message: 'Complaint text must be between 20 and 2000 characters' 
        });
    }

    // Verify parent is registered to school
    if (!req.parent?.schoolIds.includes(schoolId)) {
        return res.status(403).json({ 
            error_code: 'FORBIDDEN', 
            message: 'You are not registered as a parent for this school' 
        });
    }

    try {
        const result = await transaction(async (client) => {
            const encryptedText = encryptText(text);
            const storedParentId = isFullyAnonymous ? null : parentId;

            // 1. Insert Complaint with default values (to be computed asynchronously)
            const complaintInsert = await client.query(
                `INSERT INTO complaints (parent_id, school_id, text, photo_url, category, urgency, sentiment, status)
                 VALUES ($1, $2, $3, $4, 'Other', 'Low', 'Neutral', 'Received')
                 RETURNING *`,
                [storedParentId, schoolId, encryptedText, photoUrl || null]
            );
            const complaint = complaintInsert.rows[0];

            // 2. Insert AI Metadata with default values
            await client.query(
                `INSERT INTO complaint_ai_metadata (complaint_id, model_version, confidence, duplicate_of_id, review_status)
                 VALUES ($1, 'IndoNLP-v1.0', 0.0, null, 'Pending')`,
                [complaint.complaint_id]
            );

            return {
                complaintId: complaint.complaint_id,
                message: 'Complaint submitted successfully. AI processing initiated.',
                storedParentId
            };
        });

        // Audit log for new complaint submission
        await logAudit(null, 'COMPLAINT_SUBMITTED', 'complaints', result.complaintId, { 
            schoolId
        });

        // Enqueue AI processing job
        aiQueue.addJob({
            complaintId: result.complaintId,
            schoolId,
            text, // plaintext for embedding and classification
            parentId: result.storedParentId || null
        });

        return res.status(201).json({
            complaintId: result.complaintId,
            message: result.message
        });
    } catch (e) {
        console.error('Error submitting complaint:', e);
        return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit complaint' });
    }
});

/**
 * @route   GET /api/v1/complaints
 * @desc    Get list of complaints (Staff only, role scoped)
 * @access  Private (Staff)
 */
router.get('/', authenticateStaff, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { schoolId, district, category, urgency, status } = req.query;

    let queryStr = `
        SELECT 
            c.complaint_id, 
            c.school_id,
            s.name as school_name,
            s.district,
            c.text, 
            c.photo_url, 
            c.category, 
            c.urgency, 
            c.sentiment, 
            c.status, 
            c.created_at,
            am.confidence,
            am.duplicate_of_id,
            am.review_status,
            am.explanation,
            am.suggested_response,
            -- Expose parent details ONLY to Supervisor/Dinas-level roles with logged access (handled via security / BR-07)
            CASE WHEN $1 IN ('Admin', 'Dinas Analyst', 'Supervisor') THEN c.parent_id ELSE NULL END as parent_id
        FROM complaints c
        JOIN schools s ON c.school_id = s.school_id
        JOIN complaint_ai_metadata am ON c.complaint_id = am.complaint_id
        WHERE 1=1
    `;
    const params: any[] = [user.role];

    // BR-06: Principal can view only their own school's data
    if (user.role === 'Principal') {
        params.push(user.districtScope); // districtScope stores schoolId for Principal
        queryStr += ` AND c.school_id = $${params.length}`;
    }

    if (schoolId) {
        params.push(schoolId);
        queryStr += ` AND c.school_id = $${params.length}`;
    }

    if (district) {
        params.push(district);
        queryStr += ` AND s.district = $${params.length}`;
    }

    if (category) {
        params.push(category);
        queryStr += ` AND c.category = $${params.length}`;
    }

    if (urgency) {
        params.push(urgency);
        queryStr += ` AND c.urgency = $${params.length}`;
    }

    if (status) {
        params.push(status);
        queryStr += ` AND c.status = $${params.length}`;
    }

    queryStr += ` ORDER BY c.created_at DESC`;

    try {
        const complaintsQuery = await query(queryStr, params);

        // Audit Log for accessing identity-linked records (BR-07)
        if (['Admin', 'Dinas Analyst', 'Supervisor'].includes(user.role)) {
            await logAudit(user.userId, 'VIEW_COMPLAINTS_LIST', 'complaints', null, { 
                filters: { schoolId, district, category, urgency, status } 
            });
        }

        const decryptedComplaints = complaintsQuery.rows.map(row => ({
            ...row,
            text: decryptText(row.text)
        }));

        return res.status(200).json({ complaints: decryptedComplaints });
    } catch (e) {
        console.error('Error fetching complaints:', e);
        return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch complaints' });
    }
});

/**
 * @route   PATCH /api/v1/complaints/:id/status
 * @desc    Update complaint status & review AI tag (Principal/Supervisor/Dinas Analyst)
 * @access  Private (Staff)
 */
router.patch('/:id/status', authenticateStaff, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const complaintId = req.params.id;
    const { status, overrideCategory, overrideUrgency, overrideSentiment, isSpam } = req.body;

    if (!status) {
        return res.status(400).json({ error_code: 'BAD_REQUEST', message: 'Status is required' });
    }

    const validStatuses = ['Acknowledged', 'In Progress', 'Resolved'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error_code: 'INVALID_STATUS', message: 'Invalid status value' });
    }

    try {
        // Fetch the complaint first to verify permissions
        const compQuery = await query(
            'SELECT c.*, p.parent_id, p.identity_verified FROM complaints c LEFT JOIN parents p ON c.parent_id = p.parent_id WHERE c.complaint_id = $1', 
            [complaintId]
        );
        if (compQuery.rowCount === 0) {
            return res.status(404).json({ error_code: 'NOT_FOUND', message: 'Complaint not found' });
        }

        const complaint = compQuery.rows[0];

        // BR-06: Principal can view/edit only their own school's data
        if (user.role === 'Principal' && user.districtScope !== complaint.school_id) {
            return res.status(403).json({ error_code: 'FORBIDDEN', message: 'You can only update complaints for your own school' });
        }

        const updatedComplaint = await transaction(async (client) => {
            let finalCategory = complaint.category;
            let finalUrgency = complaint.urgency;
            let finalSentiment = complaint.sentiment;
            let reviewStatus = 'Confirmed';

            // Check if there was an override of AI categorization/urgency
            if (overrideCategory || overrideUrgency || overrideSentiment) {
                reviewStatus = 'Overridden';
                if (overrideCategory) finalCategory = overrideCategory;
                if (overrideUrgency) finalUrgency = overrideUrgency;
                if (overrideSentiment) finalSentiment = overrideSentiment;
            }

            // Update complaint status & overrides
            const updateRes = await client.query(
                `UPDATE complaints 
                 SET status = $1, category = $2, urgency = $3, sentiment = $4
                 WHERE complaint_id = $5 
                 RETURNING *`,
                [status, finalCategory, finalUrgency, finalSentiment, complaintId]
            );

            // Update AI metadata review_status
            await client.query(
                `UPDATE complaint_ai_metadata 
                 SET review_status = $1 
                 WHERE complaint_id = $2`,
                [reviewStatus, complaintId]
            );

            // Update Parent Trust Score counters if resolved or flagged as spam
            const parentId = complaint.parent_id;
            if (parentId) {
                let validInc = 0;
                let spamInc = 0;

                if (status === 'Resolved' && !isSpam) {
                    validInc = 1;
                } else if (isSpam) {
                    spamInc = 1;
                }

                if (validInc > 0 || spamInc > 0) {
                    await client.query(
                        `UPDATE parents 
                         SET valid_report_count = valid_report_count + $1, 
                             spam_flag_count = spam_flag_count + $2
                         WHERE parent_id = $3`,
                        [validInc, spamInc, parentId]
                    );

                    // Recalculate trust score
                    const pQuery = await client.query('SELECT * FROM parents WHERE parent_id = $1', [parentId]);
                    const p = pQuery.rows[0];
                    const trust = calculateParentTrust(p.valid_report_count, p.spam_flag_count, p.duplicate_flag_count, p.identity_verified);
                    await client.query(
                        'UPDATE parents SET trust_score = $1, trust_tier = $2 WHERE parent_id = $3',
                        [trust.trustScore, trust.trustTier, parentId]
                    );
                }
            }

            return updateRes.rows[0];
        });

        // Audit log
        await logAudit(user.userId, 'UPDATE_COMPLAINT_STATUS', 'complaints', complaintId, { 
            oldStatus: complaint.status, 
            newStatus: status,
            isSpam
        });

        return res.status(200).json({ complaint: updatedComplaint });
    } catch (e) {
        console.error('Error updating complaint status:', e);
        return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update status' });
    }
});

export default router;
