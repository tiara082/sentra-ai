import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateStaff, AuthenticatedRequest, requireRoles } from '../security';
import { logAudit } from '../utils/auditLogger';

const router = Router();

/**
 * @route   POST /api/v1/alerts/:id/resolve
 * @desc    Log supervisor field visit outcome and resolve/close an alert (Supervisor/Admin only)
 * @access  Private (Staff)
 */
router.post(
    '/:id/resolve',
    authenticateStaff,
    requireRoles(['Admin', 'Supervisor']),
    async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user!;
        const alertId = req.params.id;
        const { resolutionNote } = req.body;

        if (!resolutionNote) {
            return res.status(400).json({ 
                error_code: 'BAD_REQUEST', 
                message: 'resolutionNote (field visit outcome) is required' 
            });
        }

        try {
            // Check if alert exists
            const alertQuery = await query('SELECT * FROM risk_alerts WHERE alert_id = $1', [alertId]);
            if (alertQuery.rowCount === 0) {
                return res.status(404).json({ error_code: 'NOT_FOUND', message: 'Risk alert not found' });
            }

            const alert = alertQuery.rows[0];
            if (alert.status === 'Closed') {
                return res.status(400).json({ error_code: 'ALREADY_RESOLVED', message: 'Alert has already been resolved/closed' });
            }

            // Update alert status, resolution note, resolved by, and closed_at
            const updateRes = await query(
                `UPDATE risk_alerts 
                 SET status = 'Closed', 
                     closed_at = NOW(), 
                     resolution_note = $1, 
                     resolved_by = $2
                 WHERE alert_id = $3
                 RETURNING *`,
                [resolutionNote, user.userId, alertId]
            );

            // Audit log for field visit and resolution (important for transparency)
            await logAudit(user.userId, 'RESOLVE_RISK_ALERT', 'risk_alerts', alertId, {
                schoolId: alert.school_id,
                triggerType: alert.trigger_type,
                resolutionNote
            });

            return res.status(200).json({
                message: 'Field visit outcome logged and alert closed successfully.',
                alert: updateRes.rows[0]
            });
        } catch (e) {
            console.error('Error resolving risk alert:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to resolve risk alert' });
        }
    }
);

export default router;
