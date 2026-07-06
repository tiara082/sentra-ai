import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateStaff, AuthenticatedRequest, requireRoles } from '../security';
import { runPolicySimulation } from '../services/simulationEngine';
import { logAudit } from '../utils/auditLogger';

const router = Router();

/**
 * @route   POST /api/v1/simulations
 * @desc    Configure, run and save a policy simulation scenario
 * @access  Private (Staff: Admin, Dinas Analyst)
 */
router.post(
    '/', 
    authenticateStaff, 
    requireRoles(['Admin', 'Dinas Analyst']), 
    async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user!;
        const { schoolId, interventionType, magnitude, period } = req.body;

        if (!schoolId || !interventionType || magnitude === undefined) {
            return res.status(400).json({ 
                error_code: 'BAD_REQUEST', 
                message: 'schoolId, interventionType, and magnitude are required' 
            });
        }

        const validInterventions = ['add_teachers', 'increase_bos', 'infrastructure_investment'];
        if (!validInterventions.includes(interventionType)) {
            return res.status(400).json({ 
                error_code: 'INVALID_INTERVENTION', 
                message: `Intervention must be one of: [${validInterventions.join(', ')}]` 
            });
        }

        const numMagnitude = parseFloat(magnitude);
        if (isNaN(numMagnitude) || numMagnitude <= 0) {
            return res.status(400).json({ 
                error_code: 'INVALID_MAGNITUDE', 
                message: 'Magnitude must be a positive number' 
            });
        }

        try {
            const targetPeriod = period || '2026-07';

            // Run projection calculation
            const result = await runPolicySimulation(
                schoolId, 
                interventionType as any, 
                numMagnitude, 
                targetPeriod
            );

            // Save scenario to DB
            const saveRes = await query(
                `INSERT INTO simulations (school_id, intervention_type, magnitude, projected_range, created_by, created_at)
                 VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
                 RETURNING simulation_id`,
                [
                    schoolId, 
                    interventionType, 
                    numMagnitude, 
                    JSON.stringify({
                        projectedCompositeMin: result.projectedCompositeMin,
                        projectedCompositeMax: result.projectedCompositeMax,
                        projectedBreakdownMin: result.projectedBreakdownMin,
                        projectedBreakdownMax: result.projectedBreakdownMax
                    }), 
                    user.userId
                ]
            );

            // Audit Log
            await logAudit(user.userId, 'RUN_POLICY_SIMULATION', 'simulations', saveRes.rows[0].simulation_id, {
                schoolId,
                interventionType,
                magnitude: numMagnitude
            });

            return res.status(200).json({
                simulationId: saveRes.rows[0].simulation_id,
                ...result
            });
        } catch (e) {
            console.error('Error running policy simulation:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to execute policy simulation' });
        }
    }
);

export default router;
