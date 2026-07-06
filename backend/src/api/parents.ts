import { Router, Response } from 'express';
import crypto from 'crypto';
import { query, transaction } from '../db';
import { generateParentToken, authenticateParent, authenticateStaff, requireRoles, AuthenticatedRequest } from '../security';
import { calculateParentTrust } from '../services/trustScore';
import { calculateSchoolHealthScore } from '../services/healthScore';
import { analyzeSentiment } from '../services/aiComplaints';
import { logAudit } from '../utils/auditLogger';
import { encryptText } from '../utils/crypto';

const router = Router();

/**
 * Helper to hash phone numbers (Privacy by Design)
 */
function hashPhone(phone: string): string {
    return crypto.createHash('sha256').update(phone.trim()).digest('hex');
}

/**
 * @route   POST /api/v1/parents/register
 * @desc    Register parent using phone number & school linkage code (OTP simulated)
 * @access  Public
 */
router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
    let { phone, schoolIds, consent, schoolId, consentStatus } = req.body;

    // Fallbacks to support both integration tests and frontend PWA payload structures
    if (consent === undefined) {
        consent = consentStatus;
    }
    if (!schoolIds && schoolId) {
        schoolIds = [schoolId];
    }

    if (!phone || !schoolIds || !Array.isArray(schoolIds) || schoolIds.length === 0) {
        return res.status(400).json({ 
            error_code: 'BAD_REQUEST', 
            message: 'Phone number and schoolIds array are required' 
        });
    }

    if (!consent) {
        return res.status(400).json({ 
            error_code: 'CONSENT_REQUIRED', 
            message: 'Parent consent is required under UU PDP compliance' 
        });
    }

    const phoneHash = hashPhone(phone);
    const initialTrust = calculateParentTrust(0, 0, 0, true); // verified identity

    try {
        const token = await transaction(async (client) => {
            // Check if parent already exists
            let parentQuery = await client.query(
                'SELECT parent_id FROM parents WHERE phone_hash = $1',
                [phoneHash]
            );
            
            let parentId: string;
            
            if (parentQuery.rowCount > 0) {
                parentId = parentQuery.rows[0].parent_id;
                // Update identity verification status if not already set
                await client.query(
                    `UPDATE parents 
                     SET identity_verified = TRUE, trust_score = $1, trust_tier = $2 
                     WHERE parent_id = $3`,
                    [initialTrust.trustScore, initialTrust.trustTier, parentId]
                );
            } else {
                // Insert new parent
                const insertQuery = await client.query(
                    `INSERT INTO parents (phone_hash, consent_status, trust_score, trust_tier, identity_verified)
                     VALUES ($1, $2, $3, $4, TRUE)
                     RETURNING parent_id`,
                    [phoneHash, consent, initialTrust.trustScore, initialTrust.trustTier]
                );
                parentId = insertQuery.rows[0].parent_id;
            }

            // Link parent to schools (avoid duplicates in join table)
            for (const schoolId of schoolIds) {
                await client.query(
                    `INSERT INTO parent_schools (parent_id, school_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [parentId, schoolId]
                );
            }

            // Generate parent session token
            return generateParentToken({
                parentId,
                phoneHash,
                schoolIds
            });
        });

        return res.status(200).json({
            token,
            message: 'Parent registered and verified successfully.'
        });
    } catch (e) {
        console.error('Error registering parent:', e);
        return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to register parent' });
    }
});

/**
 * @route   POST /api/v1/parent-pulse/submit
 * @desc    Submit monthly Parent Pulse survey response
 * @access  Private (Parent Session)
 */
router.post('/submit', authenticateParent, async (req: AuthenticatedRequest, res: Response) => {
    const parentId = req.parent?.parentId;
    const { schoolId, period, topicScores, freeText } = req.body;

    if (!schoolId || !period || !topicScores) {
        return res.status(400).json({ 
            error_code: 'BAD_REQUEST', 
            message: 'schoolId, period, and topicScores are required' 
        });
    }

    // Verify parent is linked to this school
    if (!req.parent?.schoolIds.includes(schoolId)) {
        return res.status(403).json({ 
            error_code: 'FORBIDDEN', 
            message: 'You are not registered as a parent for this school' 
        });
    }

    // 9 survey topics validation
    const requiredTopics = [
        'teacher_attendance', 'cleanliness', 'bullying', 'facilities', 
        'learning_quality', 'communication', 'school_safety', 'illegal_fees', 'satisfaction'
    ];

    for (const topic of requiredTopics) {
        const val = topicScores[topic];
        if (val === undefined || typeof val !== 'number' || val < 1 || val > 5) {
            return res.status(400).json({ 
                error_code: 'INVALID_SURVEY', 
                message: `Topic [${topic}] score must be an integer between 1 and 5` 
            });
        }
    }

    try {
        // Enforce BR-01: One submission per parent-school-period
        const checkQuery = await query(
            `SELECT response_id FROM parent_pulse_responses 
             WHERE parent_id = $1 AND school_id = $2 AND period = $3`,
            [parentId, schoolId, period]
        );

        if (checkQuery.rowCount && checkQuery.rowCount > 0) {
            return res.status(400).json({ 
                error_code: 'DUPLICATE_SUBMISSION', 
                message: 'You have already submitted a survey for this school during this period' 
            });
        }

        // Insert Parent Pulse Response
        const encryptedFreeText = freeText ? encryptText(freeText) : null;
        await query(
            `INSERT INTO parent_pulse_responses (parent_id, school_id, period, topic_scores, free_text)
             VALUES ($1, $2, $3, $4::jsonb, $5)`,
            [parentId, schoolId, period, JSON.stringify(topicScores), encryptedFreeText]
        );

        // Analyze sentiment of free text if present
        if (freeText) {
            const sentimentResult = await analyzeSentiment(freeText);
            // Optionally could log or trigger warning if very negative
        }

        // Recalculate School Health Score for the school and period immediately
        await calculateSchoolHealthScore(schoolId, period);

        return res.status(200).json({ 
            message: 'Parent Pulse survey response submitted successfully.' 
        });
    } catch (e) {
        console.error('Error submitting parent pulse:', e);
        return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to submit survey' });
    }
});

/**
 * @route   GET /api/v1/parents/:id/trust
 * @desc    Get parent trust profile (Staff only: Admin, Dinas, Supervisor)
 * @access  Private (Staff)
 */
router.get(
    '/:id/trust',
    authenticateStaff,
    requireRoles(['Admin', 'Dinas Analyst', 'Supervisor']),
    async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user!;
        const parentId = req.params.id;

        try {
            const pQuery = await query(
                `SELECT parent_id, phone_hash, consent_status, created_at, trust_score, trust_tier, 
                        valid_report_count, spam_flag_count, duplicate_flag_count, identity_verified 
                 FROM parents WHERE parent_id = $1`,
                [parentId]
            );

            if (pQuery.rowCount === 0) {
                return res.status(404).json({ error_code: 'NOT_FOUND', message: 'Parent profile not found' });
            }

            const parent = pQuery.rows[0];

            // Audit logging for access to identity-linked parent details (BR-07 / PDPA compliance)
            await logAudit(user.userId, 'VIEW_PARENT_TRUST_PROFILE', 'parents', parentId, {
                reason: 'Inspecting parent trust metrics'
            });

            return res.status(200).json({ parent });
        } catch (e) {
            console.error('Error fetching parent trust profile:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve parent trust profile' });
        }
    }
);

export default router;
