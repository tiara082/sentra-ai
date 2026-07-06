import { query } from '../db';

export interface GroundTruthFlagResult {
    flagId?: string;
    schoolId: string;
    indicator: string;
    officialValue: number;
    parentValue: number;
    gapScore: number; // z-score
    period: string;
    isAnomaly: boolean;
    explanation: string;
}

/**
 * Runs Ground Truth anomaly detection across all schools for a given period.
 * Flags inconsistencies that exceed 1.5 standard deviations from the peer-group mean.
 * Requires at least 15 parent responses per school (BR-04).
 */
export async function detectGroundTruthGaps(period: string): Promise<GroundTruthFlagResult[]> {
    // 1. Get schools, their cluster, official indicators, and parent pulse aggregates
    // We will look at two main indicator gaps:
    // a. Teacher Attendance: 'teacher_attendance' (official) vs 'teacher_attendance' (parent pulse)
    // b. Facilities Condition: 'infrastructure_condition' (official) vs 'facilities' (parent pulse)
    
    const queryStr = `
        SELECT 
            s.school_id, 
            s.name, 
            s.cluster_id,
            -- Official indicators
            COALESCE(MAX(CASE WHEN oi.field = 'teacher_attendance' THEN oi.value END), 0) as official_teacher_attendance,
            COALESCE(MAX(CASE WHEN oi.field = 'infrastructure_condition' THEN oi.value END), 0) as official_infra,
            -- Parent Pulse counts and averages
            COUNT(ppr.response_id) as response_count,
            COALESCE(AVG(CAST(ppr.topic_scores->>'teacher_attendance' AS DOUBLE PRECISION)), 0) as parent_teacher_attendance_raw,
            COALESCE(AVG(CAST(ppr.topic_scores->>'facilities' AS DOUBLE PRECISION)), 0) as parent_facilities_raw
        FROM schools s
        LEFT JOIN official_indicators oi ON s.school_id = oi.school_id AND oi.period = $1
        LEFT JOIN parent_pulse_responses ppr ON s.school_id = ppr.school_id AND ppr.period = $1
        GROUP BY s.school_id, s.name, s.cluster_id
    `;
    
    const res = await query(queryStr, [period]);
    const schoolData = res.rows;
    
    // We will process two indicators: 'teacher_attendance' and 'facilities'
    const results: GroundTruthFlagResult[] = [];
    
    const indicatorKeys = [
        { 
            name: 'Teacher Attendance', 
            getOfficial: (row: any) => parseFloat(row.official_teacher_attendance),
            // Parent value is 1-5 scale, convert to 0-100 scale: (val - 1) * 25
            getParent: (row: any) => row.parent_teacher_attendance_raw > 0 ? (row.parent_teacher_attendance_raw - 1) * 25 : 0
        },
        { 
            name: 'Facilities', 
            getOfficial: (row: any) => parseFloat(row.official_infra),
            getParent: (row: any) => row.parent_facilities_raw > 0 ? (row.parent_facilities_raw - 1) * 25 : 0
        }
    ];

    // Process each indicator type
    for (const ind of indicatorKeys) {
        // 1. Calculate gaps for all schools in the dataset that have at least 1 response
        // This gives us a rich baseline dataset even if most schools have < 15 responses.
        const allGaps: { schoolId: string; clusterId: number; gap: number; official: number; parent: number; responseCount: number }[] = [];
        
        schoolData.forEach(row => {
            const responseCount = parseInt(row.response_count);
            const official = ind.getOfficial(row);
            const parent = ind.getParent(row);
            const gap = official - parent;
            
            allGaps.push({
                schoolId: row.school_id,
                clusterId: row.cluster_id,
                gap,
                official,
                parent,
                responseCount
            });
        });

        // 2. Process schools that satisfy BR-04 (responseCount >= 15)
        for (const item of allGaps) {
            if (item.responseCount < 15) {
                continue; // Skip flagging if under 15 responses (BR-04)
            }

            // Find baseline peer group (same cluster with >= 1 responses)
            const peerGaps = allGaps.filter(g => g.clusterId === item.clusterId && g.responseCount >= 1);

            let meanGap = 0;
            let stdDev = 10.0; // Default standard deviation (10%) if peer data is insufficient

            if (peerGaps.length >= 3) {
                meanGap = peerGaps.reduce((sum, g) => sum + g.gap, 0) / peerGaps.length;
                const variance = peerGaps.reduce((sum, g) => sum + Math.pow(g.gap - meanGap, 2), 0) / peerGaps.length;
                stdDev = Math.sqrt(variance) || 1.0;
            } else {
                // Fallback: check global dataset of schools with >= 1 responses
                const globalGaps = allGaps.filter(g => g.responseCount >= 1);
                if (globalGaps.length >= 3) {
                    meanGap = globalGaps.reduce((sum, g) => sum + g.gap, 0) / globalGaps.length;
                    const variance = globalGaps.reduce((sum, g) => sum + Math.pow(g.gap - meanGap, 2), 0) / globalGaps.length;
                    stdDev = Math.sqrt(variance) || 1.0;
                }
            }

            // Calculate z-score
            const zScore = (item.gap - meanGap) / stdDev;
            const isAnomaly = zScore > 1.5;

            if (isAnomaly) {
                const explanation = `Official ${ind.name}: ${item.official.toFixed(1)}%. Parent-reported ${ind.name}: ${item.parent.toFixed(1)}%. Gap exceeds peer-group average by ${zScore.toFixed(1)} standard deviations.`;
                
                // Save anomaly flag to DB
                const flagInsert = await query(
                    `INSERT INTO ground_truth_flags (school_id, indicator, official_value, parent_value, gap_score, period, status, explanation)
                     VALUES ($1, $2, $3, $4, $5, $6, 'Active', $7)
                     ON CONFLICT (school_id, indicator, period) 
                     DO UPDATE SET official_value = EXCLUDED.official_value,
                                   parent_value = EXCLUDED.parent_value,
                                   gap_score = EXCLUDED.gap_score,
                                   explanation = EXCLUDED.explanation,
                                   status = CASE WHEN ground_truth_flags.status = 'Resolved' THEN 'Active' ELSE ground_truth_flags.status END
                     RETURNING flag_id`,
                    [item.schoolId, ind.name, item.official, item.parent, zScore, period, explanation]
                );

                results.push({
                    flagId: flagInsert.rows[0].flag_id,
                    schoolId: item.schoolId,
                    indicator: ind.name,
                    officialValue: item.official,
                    parentValue: item.parent,
                    gapScore: parseFloat(zScore.toFixed(2)),
                    period,
                    isAnomaly: true,
                    explanation
                });
            }
        }
    }

    return results;
}
