import { Router, Response } from 'express';
import { query, transaction } from '../db';
import { authenticateStaff, AuthenticatedRequest, requireRoles } from '../security';
import { calculateSchoolHealthScore } from '../services/healthScore';
import { detectGroundTruthGaps } from '../services/groundTruth';
import { logAudit } from '../utils/auditLogger';
import { trainModel } from '../train';
import { reloadModels } from '../services/aiComplaints';

const router = Router();

/**
 * @route   POST /api/v1/data-integration/import
 * @desc    Upload and trigger official data batch import (Dapodik/BOS/GTK etc.)
 * @access  Private (Staff: Admin)
 */
router.post(
    '/data-integration/import',
    authenticateStaff,
    requireRoles(['Admin']),
    async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user!;
        const { source, period, records } = req.body;

        const validSources = ['dapodik', 'bos', 'gtk', 'accreditation', 'assessment', 'infrastructure', 'enrollment'];
        if (!source || !validSources.includes(source)) {
            return res.status(400).json({ 
                error_code: 'BAD_REQUEST', 
                message: `Source must be one of: [${validSources.join(', ')}]` 
            });
        }

        if (!period || !records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ 
                error_code: 'BAD_REQUEST', 
                message: 'period and records array are required' 
            });
        }

        try {
            const affectedSchools: string[] = [];

            await transaction(async (client) => {
                for (const rec of records) {
                    const { schoolId, field, value } = rec;
                    
                    if (!schoolId || !field || value === undefined) {
                        throw new Error('Malformed record: schoolId, field, and value are required');
                    }

                    await client.query(
                        `INSERT INTO official_indicators (school_id, source, period, field, value, created_at)
                         VALUES ($1, $2, $3, $4, $5, NOW())
                         ON CONFLICT (school_id, source, period, field)
                         DO UPDATE SET value = EXCLUDED.value, created_at = NOW()`,
                        [schoolId, source, period, field, value]
                    );

                    if (!affectedSchools.includes(schoolId)) {
                        affectedSchools.push(schoolId);
                    }
                }
            });

            // Post-Import: Recalculate School Health Scores for affected schools
            for (const schoolId of affectedSchools) {
                await calculateSchoolHealthScore(schoolId, period);
            }

            // Run Ground Truth Gap detection automatically
            // Gaps are flagged as anomalies if they deviate from peer averages.
            let activeFlagsCount = 0;
            try {
                const gaps = await detectGroundTruthGaps(period);
                activeFlagsCount = gaps.length;
            } catch (gtErr) {
                console.error('Error running Ground Truth detection after import:', gtErr);
            }

            // Audit log
            await logAudit(user.userId, 'BATCH_DATA_IMPORT', 'official_indicators', null, {
                source,
                period,
                recordsCount: records.length,
                affectedSchoolsCount: affectedSchools.length,
                newGroundTruthFlags: activeFlagsCount
            });

            return res.status(200).json({
                message: `Successfully imported ${records.length} records for source [${source}].`,
                affectedSchoolsCount: affectedSchools.length,
                groundTruthFlagsCount: activeFlagsCount
            });
        } catch (e: any) {
            console.error('Data import failed:', e);
            return res.status(500).json({ 
                error_code: 'IMPORT_FAILED', 
                message: e.message || 'Failed to complete data import batch' 
            });
        }
    }
);

/**
 * @route   GET /api/v1/audit-logs
 * @desc    Retrieve system audit log entries (Admin/Compliance Officer only)
 * @access  Private (Staff: Admin, Compliance Officer)
 */
router.get(
    '/audit-logs',
    authenticateStaff,
    requireRoles(['Admin', 'Compliance Officer']),
    async (req: AuthenticatedRequest, res: Response) => {
        const { limit, offset, action, targetEntity } = req.query;

        try {
            let queryStr = `
                SELECT al.*, u.name as actor_name, u.role as actor_role 
                FROM audit_logs al
                LEFT JOIN users u ON al.actor_id = u.user_id
                WHERE 1=1
            `;
            const params: any[] = [];

            if (action) {
                params.push(action);
                queryStr += ` AND al.action = $${params.length}`;
            }

            if (targetEntity) {
                params.push(targetEntity);
                queryStr += ` AND al.target_entity = $${params.length}`;
            }

            queryStr += ` ORDER BY al.timestamp DESC`;

            const numLimit = parseInt(limit as string) || 50;
            const numOffset = parseInt(offset as string) || 0;

            params.push(numLimit);
            queryStr += ` LIMIT $${params.length}`;

            params.push(numOffset);
            queryStr += ` OFFSET $${params.length}`;

            const logsQuery = await query(queryStr, params);

            return res.status(200).json({
                logs: logsQuery.rows,
                limit: numLimit,
                offset: numOffset
            });
        } catch (e) {
            console.error('Error fetching audit logs:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve audit logs' });
        }
    }
);

/**
 * @route   GET /api/v1/alerts
 * @desc    Retrieve active early warning alerts
 * @access  Private (Staff: Admin, Dinas Analyst, Supervisor)
 */
router.get(
    '/alerts',
    authenticateStaff,
    requireRoles(['Admin', 'Dinas Analyst', 'Supervisor']),
    async (req: AuthenticatedRequest, res: Response) => {
        const { status, severity } = req.query;

        try {
            let queryStr = `
                SELECT ra.*, s.name as school_name, s.district 
                FROM risk_alerts ra
                JOIN schools s ON ra.school_id = s.school_id
                WHERE 1=1
            `;
            const params: any[] = [];

            if (status) {
                params.push(status);
                queryStr += ` AND ra.status = $${params.length}`;
            }

            if (severity) {
                params.push(severity);
                queryStr += ` AND ra.severity = $${params.length}`;
            }

            queryStr += ` ORDER BY ra.opened_at DESC`;

            const alertsQuery = await query(queryStr, params);

            return res.status(200).json({ alerts: alertsQuery.rows });
        } catch (e) {
            console.error('Error fetching alerts:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve active alerts' });
        }
    }
);

/**
 * @route   POST /api/v1/admin/train
 * @desc    Retrain and hot-reload Category and Sentiment AI models from DB reviewed data + pre-seeded data
 * @access  Private (Staff: Admin)
 */
router.post(
    '/admin/train',
    authenticateStaff,
    requireRoles(['Admin']),
    async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user!;
        try {
            await trainModel();
            reloadModels(); // hot-reload

            await logAudit(user.userId, 'RETRAIN_AI_MODELS', 'system', null, {
                timestamp: new Date().toISOString()
            });

            return res.status(200).json({ 
                message: 'AI model successfully retrained and hot-reloaded into memory.' 
            });
        } catch (e: any) {
            console.error('AI Retraining failed:', e);
            return res.status(500).json({ 
                error_code: 'RETRAIN_FAILED', 
                message: e.message || 'Failed to retrain AI models' 
            });
        }
    }
);

export default router;
