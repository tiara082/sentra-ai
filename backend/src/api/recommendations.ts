import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateStaff, AuthenticatedRequest, requireRoles } from '../security';
import { generatePriorityRecommendations } from '../services/recommendationEngine';
import { logAudit } from '../utils/auditLogger';

const router = Router();

/**
 * @route   GET /api/v1/recommendations
 * @desc    Retrieve current ranked priority school list with recommended interventions
 * @access  Private (Staff: Admin, Dinas Analyst, Supervisor)
 */
router.get(
    '/', 
    authenticateStaff, 
    requireRoles(['Admin', 'Dinas Analyst', 'Supervisor']), 
    async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user!;
        const { period, refresh } = req.query;

        try {
            const targetPeriod = (period as string) || '2026-07';

            // Check if recommendations already exist for this period
            const checkQuery = await query(
                `SELECT r.recommendation_id, r.school_id, s.name as school_name, s.district, s.cluster_id, r.rank, r.rationale, r.score_components
                 FROM recommendations r
                 JOIN schools s ON r.school_id = s.school_id
                 WHERE r.period = $1
                 ORDER BY r.rank ASC`,
                [targetPeriod]
            );

            let recommendations = checkQuery.rows;

            // Generate/Refresh if not present or explicit refresh requested
            if (recommendations.length === 0 || refresh === 'true') {
                const refreshed = await generatePriorityRecommendations(targetPeriod);
                
                // Fetch again to match DB structure format
                const fetchQuery = await query(
                    `SELECT r.recommendation_id, r.school_id, s.name as school_name, s.district, s.cluster_id, r.rank, r.rationale, r.score_components
                     FROM recommendations r
                     JOIN schools s ON r.school_id = s.school_id
                     WHERE r.period = $1
                     ORDER BY r.rank ASC`,
                    [targetPeriod]
                );
                recommendations = fetchQuery.rows;

                // Log audit for recommendation generation
                await logAudit(user.userId, 'GENERATE_RECOMMENDATIONS', 'recommendations', null, { period: targetPeriod });
            } else {
                // Log audit for accessing recommendations list
                await logAudit(user.userId, 'VIEW_RECOMMENDATIONS', 'recommendations', null, { period: targetPeriod });
            }

            return res.status(200).json({ recommendations });
        } catch (e) {
            console.error('Error fetching recommendations:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to retrieve recommendations' });
        }
    }
);

/**
 * @route   GET /api/v1/recommendations/export
 * @desc    Export priority schools recommendations to CSV file
 * @access  Private (Staff: Admin, Dinas Analyst, Supervisor)
 */
router.get(
    '/export',
    authenticateStaff,
    requireRoles(['Admin', 'Dinas Analyst', 'Supervisor']),
    async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user!;
        const { period } = req.query;

        try {
            const targetPeriod = (period as string) || '2026-07';

            // Query recommendations
            const checkQuery = await query(
                `SELECT r.rank, s.npsn, s.name as school_name, s.district, s.cluster_id, 
                        hs.composite_score, r.rationale, r.score_components
                 FROM recommendations r
                 JOIN schools s ON r.school_id = s.school_id
                 LEFT JOIN health_scores hs ON s.school_id = hs.school_id AND hs.period = r.period
                 WHERE r.period = $1
                 ORDER BY r.rank ASC`,
                [targetPeriod]
            );

            const rows = checkQuery.rows;

            // Generate CSV string
            let csvContent = 'Rank,NPSN,School Name,District,Cluster,Composite Health Score,Recommended Intervention,Rationale\n';

            rows.forEach(r => {
                const comp = r.score_components || {};
                const recommendedIntervention = comp.recommendedIntervention || 'Increase BOS Funding';
                
                // Escape commas and double quotes for CSV safety
                const escapedName = `"${r.school_name.replace(/"/g, '""')}"`;
                const escapedDistrict = `"${r.district.replace(/"/g, '""')}"`;
                const escapedIntervention = `"${recommendedIntervention.replace(/"/g, '""')}"`;
                const escapedRationale = `"${r.rationale.replace(/"/g, '""')}"`;

                csvContent += `${r.rank},${r.npsn},${escapedName},${escapedDistrict},${r.cluster_id},${parseFloat(r.composite_score).toFixed(2)},${escapedIntervention},${escapedRationale}\n`;
            });

            // Log audit for export action (FR-17)
            await logAudit(user.userId, 'EXPORT_RECOMMENDATIONS_CSV', 'recommendations', null, {
                period: targetPeriod,
                recordsCount: rows.length
            });

            // Set headers for download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=EduPolicy_Recommendations_${targetPeriod}.csv`);
            return res.status(200).send(csvContent);
        } catch (e) {
            console.error('Error exporting recommendations:', e);
            return res.status(500).json({ error_code: 'INTERNAL_SERVER_ERROR', message: 'Failed to export recommendations CSV' });
        }
    }
);

export default router;
