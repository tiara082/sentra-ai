import { query } from '../db';
import { calculateParentTrust } from './trustScore'; // verify if needed

export interface PriorityRecommendation {
    schoolId: string;
    schoolName: string;
    district: string;
    clusterId: number;
    compositeScore: number;
    rank: number;
    recommendedIntervention: string;
    rationale: string;
    priorityScore: number;
}

/**
 * Generates and saves the ranked list of priority schools for a given period.
 */
export async function generatePriorityRecommendations(period: string): Promise<PriorityRecommendation[]> {
    // 1. Fetch schools, health scores, active ground truth flags, and active alerts
    const queryStr = `
        SELECT 
            s.school_id, 
            s.name as school_name, 
            s.district, 
            s.cluster_id,
            COALESCE(hs.composite_score, 50.0) as composite_score,
            hs.dimension_breakdown,
            (SELECT COUNT(*) FROM ground_truth_flags gtf WHERE gtf.school_id = s.school_id AND gtf.period = $1 AND gtf.status = 'Active') as active_flags,
            (SELECT COUNT(*) FROM risk_alerts ra WHERE ra.school_id = s.school_id AND ra.status = 'Open') as active_alerts,
            -- Get list of indicators flagged in ground truth
            ARRAY(SELECT gtf.indicator FROM ground_truth_flags gtf WHERE gtf.school_id = s.school_id AND gtf.period = $1 AND gtf.status = 'Active') as flagged_indicators
        FROM schools s
        LEFT JOIN health_scores hs ON s.school_id = hs.school_id AND hs.period = $1
    `;

    const res = await query(queryStr, [period]);
    const rawSchools = res.rows;

    const list: PriorityRecommendation[] = [];

    // Calculate priority scores
    rawSchools.forEach(row => {
        const compositeScore = parseFloat(row.composite_score);
        const activeFlags = parseInt(row.active_flags);
        const activeAlerts = parseInt(row.active_alerts);
        
        // Priority Score formula: lower health score, higher active alerts/flags increase priority
        const priorityScore = (100 - compositeScore) + (activeFlags * 15) + (activeAlerts * 20);

        // Determine recommended intervention based on lowest dimension score
        let recommendedIntervention = 'Increase BOS Funding';
        let interventionType = 'increase_bos';
        let lowestDimension = 'finance';
        let lowestScore = 100;

        const breakdown = row.dimension_breakdown;
        if (breakdown) {
            const dimensions = [
                { name: 'teacher', type: 'add_teachers', label: 'Add Teachers', score: breakdown.teacher || 100 },
                { name: 'infrastructure', type: 'infrastructure_investment', label: 'Infrastructure Investment', score: breakdown.infrastructure || 100 },
                { name: 'studentWelfare', type: 'infrastructure_investment', label: 'Infrastructure Investment', score: breakdown.studentWelfare || 100 },
                { name: 'finance', type: 'increase_bos', label: 'Increase BOS Funding', score: breakdown.finance || 100 }
            ];

            dimensions.forEach(d => {
                if (d.score < lowestScore) {
                    lowestScore = d.score;
                    recommendedIntervention = d.label;
                    interventionType = d.type;
                    lowestDimension = d.name;
                }
            });
        }

        // Generate Rationale Text
        let rationale = `Health Score of ${compositeScore.toFixed(0)}/100. `;
        if (activeFlags > 0) {
            rationale += `Ground Truth inconsistency flagged in: ${row.flagged_indicators.join(', ')}. `;
        }
        if (activeAlerts > 0) {
            rationale += `${activeAlerts} active risk alert(s) registered. `;
        }
        rationale += `Recommended intervention is ${recommendedIntervention} to address deficiencies in the ${lowestDimension} dimension.`;

        list.push({
            schoolId: row.school_id,
            schoolName: row.school_name,
            district: row.district,
            clusterId: row.cluster_id,
            compositeScore,
            rank: 0, // Assigned later after sorting
            recommendedIntervention,
            rationale,
            priorityScore
        });
    });

    // Sort by priorityScore descending
    list.sort((a, b) => b.priorityScore - a.priorityScore);

    // Assign Ranks and save to DB
    const savedRecs: PriorityRecommendation[] = [];
    for (let i = 0; i < list.length; i++) {
        const rank = i + 1;
        const rec = list[i];
        rec.rank = rank;

        // Save snapshot to DB
        await query(
            `INSERT INTO recommendations (period, school_id, rank, rationale, score_components, created_at)
             VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
             ON CONFLICT (school_id, period)
             DO UPDATE SET rank = EXCLUDED.rank,
                           rationale = EXCLUDED.rationale,
                           score_components = EXCLUDED.score_components,
                           created_at = NOW()`,
            [
                period, 
                rec.schoolId, 
                rec.rank, 
                rec.rationale, 
                JSON.stringify({ 
                    priorityScore: rec.priorityScore, 
                    compositeScore: rec.compositeScore,
                    recommendedIntervention: rec.recommendedIntervention
                })
            ]
        );

        savedRecs.push(rec);
    }

    return savedRecs;
}
