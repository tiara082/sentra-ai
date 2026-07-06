import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateStaff, AuthenticatedRequest, requireRoles } from '../security';
import { calculateSchoolHealthScore } from '../services/healthScore';

const router = Router();

/**
 * @route   GET /api/v1/schools/:id/health-score
 * @desc    Get current & historical School Health Score
 * @access  Private (Staff)
 */
router.get('/:id/health-score', authenticateStaff, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const schoolId = req.params.id;
    const { period } = req.query;

    // BR-06: Principal can only view their own school's data
    if (user.role === 'Principal' && user.districtScope !== schoolId) {
        return res.status(403).json({ error_code: 'FORBIDDEN', message: 'Access denied: you can only view your own school' });
    }

    try {
        const targetPeriod = (period as string) || '2026-07';

        // Recalculate/ensure health score is computed for this period
        const currentHS = await calculateSchoolHealthScore(schoolId, targetPeriod);

        // Fetch historical scores
        const historyQuery = await query(
            `SELECT period, composite_score, dimension_breakdown, completeness_pct 
             FROM health_scores 
             WHERE school_id = $1 
             ORDER BY period DESC 
             LIMIT 12`,
            [schoolId]
        );

        return res.status(200).json({
            current: currentHS,
            history: historyQuery.rows
        });
    } catch (e) {
        console.error('Error fetching health score:', e);
        return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve health score' });
    }
});

/**
 * @route   GET /api/v1/schools/:id/ground-truth-flags
 * @desc    Get Ground Truth inconsistency flags for a school
 * @access  Private (Staff: Admin, Dinas Analyst, Supervisor)
 */
router.get(
    '/:id/ground-truth-flags', 
    authenticateStaff, 
    async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user!;
        const schoolId = req.params.id;

        // BR-06: Principal can only view their own school's data
        if (user.role === 'Principal' && user.districtScope !== schoolId) {
            return res.status(403).json({ error_code: 'FORBIDDEN', message: 'Access denied: you can only view your own school' });
        }

        const allowedRoles = ['Admin', 'Dinas Analyst', 'Supervisor', 'Principal'];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ error_code: 'FORBIDDEN', message: 'Access denied: invalid role' });
        }

        const { period } = req.query;

        try {
            let queryStr = `SELECT * FROM ground_truth_flags WHERE school_id = $1`;
            const params: any[] = [schoolId];

            if (period) {
                params.push(period);
                queryStr += ` AND period = $2`;
            }

            queryStr += ` ORDER BY period DESC, created_at DESC`;

            const flagsQuery = await query(queryStr, params);

            return res.status(200).json({ flags: flagsQuery.rows });
        } catch (e) {
            console.error('Error fetching ground truth flags:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve ground truth flags' });
        }
    }
);

/**
 * @route   GET /api/v1/risk-map
 * @desc    Get geospatial risk indicators for map rendering (District-wide)
 * @access  Private (Staff: Admin, Dinas Analyst, Supervisor)
 */
router.get(
    '/risk-map', 
    authenticateStaff, 
    requireRoles(['Admin', 'Dinas Analyst', 'Supervisor']), 
    async (req: AuthenticatedRequest, res: Response) => {
        const { period } = req.query;

        try {
            const targetPeriod = (period as string) || '2026-07';

            // Query retrieves all schools with latest health score, active flags count, and active alerts count
            const mapQuery = await query(
                `SELECT 
                    s.school_id, 
                    s.name, 
                    s.npsn, 
                    s.district, 
                    s.geo_lat, 
                    s.geo_lng, 
                    s.cluster_id,
                    COALESCE(hs.composite_score, 0) as health_score,
                    (SELECT COUNT(*) FROM ground_truth_flags gtf WHERE gtf.school_id = s.school_id AND gtf.period = $1 AND gtf.status = 'Active') as active_flags,
                    (SELECT COUNT(*) FROM risk_alerts ra WHERE ra.school_id = s.school_id AND ra.status = 'Open') as active_alerts
                 FROM schools s
                 LEFT JOIN health_scores hs ON s.school_id = hs.school_id AND hs.period = $1`,
                [targetPeriod]
            );

            return res.status(200).json({ schools: mapQuery.rows });
        } catch (e) {
            console.error('Error fetching risk map data:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve risk map data' });
        }
    }
);

/**
 * @route   GET /api/v1/schools
 * @desc    Get list of all schools (public selection for parent linkage)
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const schoolsQuery = await query(
            `SELECT school_id, name, npsn, district, geo_lat, geo_lng, cluster_id 
             FROM schools 
             ORDER BY name ASC`
        );
        return res.status(200).json({ schools: schoolsQuery.rows });
    } catch (e) {
        console.error('Error fetching schools list:', e);
        return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve schools list' });
    }
});

export default router;
