import { query } from '../db';
import { config } from '../config';

export interface DimensionBreakdown {
    academic: number | null;
    teacher: number | null;
    infrastructure: number | null;
    finance: number | null;
    parentSatisfaction: number | null;
    studentWelfare: number | null;
    governance: number | null;
}

export interface HealthScoreResult {
    compositeScore: number;
    dimensionBreakdown: DimensionBreakdown;
    completenessPct: number;
    isProvisional: boolean;
}

/**
 * Calculates and saves the School Health Score for a given school and period
 */
export async function calculateSchoolHealthScore(
    schoolId: string,
    period: string
): Promise<HealthScoreResult> {
    // 1. Fetch Official Indicators for this school and period
    const officialRes = await query(
        `SELECT field, value FROM official_indicators WHERE school_id = $1 AND period = $2`,
        [schoolId, period]
    );

    const officialMap: Record<string, number> = {};
    officialRes.rows.forEach(row => {
        officialMap[row.field] = parseFloat(row.value);
    });

    // 2. Fetch Parent Pulse survey ratings for this school and period
    // The topics map to dimensions.
    // Topics: teacher_attendance, cleanliness, bullying, facilities, learning_quality, communication, school_safety, illegal_fees, satisfaction
    const parentPulseRes = await query(
        `SELECT topic_scores FROM parent_pulse_responses WHERE school_id = $1 AND period = $2`,
        [schoolId, period]
    );

    let avgPulse: Record<string, number> = {};
    if (parentPulseRes.rowCount && parentPulseRes.rowCount > 0) {
        const sums: Record<string, number> = {};
        const count = parentPulseRes.rowCount;

        parentPulseRes.rows.forEach(row => {
            const scores = row.topic_scores;
            for (const [topic, val] of Object.entries(scores)) {
                sums[topic] = (sums[topic] || 0) + (val as number);
            }
        });

        for (const [topic, sum] of Object.entries(sums)) {
            // Convert 1-5 scale to 0-100 scale: (val - 1) * 25
            avgPulse[topic] = ((sum / count) - 1) * 25;
        }
    }

    // 3. Fetch complaints during this period (to penalize student welfare or safety)
    const complaintsRes = await query(
        `SELECT category, urgency FROM complaints 
         WHERE school_id = $1 AND created_at >= TO_TIMESTAMP($2 || '-01', 'YYYY-MM-DD') 
         AND created_at < TO_TIMESTAMP($2 || '-01', 'YYYY-MM-DD') + INTERVAL '1 month'`,
        [schoolId, period]
    );

    let bullyingCount = 0;
    let criticalSafetyCount = 0;
    complaintsRes.rows.forEach(row => {
        if (row.category === 'Bullying') bullyingCount++;
        if (row.category === 'Safety' || row.urgency === 'Critical') criticalSafetyCount++;
    });

    // --- DIMENSION SCORE COMPUTATION ---
    
    // Academic Dimension: official indicator 'academic_performance' or 'national_assessment_score'
    let academicScore: number | null = null;
    if (officialMap['academic_performance'] !== undefined) {
        academicScore = officialMap['academic_performance'];
    }

    // Teacher Dimension: official 'teacher_attendance' (e.g. 98 -> 98%) cross-checked with parent-reported 'teacher_attendance'
    let teacherScore: number | null = null;
    const offTeacherAtt = officialMap['teacher_attendance'];
    const parentTeacherAtt = avgPulse['teacher_attendance'];
    if (offTeacherAtt !== undefined && parentTeacherAtt !== undefined) {
        // Average them
        teacherScore = (offTeacherAtt + parentTeacherAtt) / 2;
    } else if (offTeacherAtt !== undefined) {
        teacherScore = offTeacherAtt;
    } else if (parentTeacherAtt !== undefined) {
        teacherScore = parentTeacherAtt;
    }

    // Infrastructure Dimension: official 'infrastructure_condition' and parent-reported 'facilities' and 'cleanliness'
    let infraScore: number | null = null;
    const offInfra = officialMap['infrastructure_condition'];
    const parentInfra = avgPulse['facilities'];
    const parentClean = avgPulse['cleanliness'];
    
    const infraComponents: number[] = [];
    if (offInfra !== undefined) infraComponents.push(offInfra);
    if (parentInfra !== undefined) infraComponents.push(parentInfra);
    if (parentClean !== undefined) infraComponents.push(parentClean);
    if (infraComponents.length > 0) {
        infraScore = infraComponents.reduce((a, b) => a + b, 0) / infraComponents.length;
    }

    // Finance Dimension: official 'bos_compliance' (0-100) minus penalties for parent-reported 'illegal_fees'
    let financeScore: number | null = null;
    const offBos = officialMap['bos_compliance'];
    const parentFeesRating = avgPulse['illegal_fees']; // Note: higher rating means fees are high (bad). So we invert: 100 - rating
    if (offBos !== undefined && parentFeesRating !== undefined) {
        const invertedFees = 100 - parentFeesRating;
        financeScore = (offBos + invertedFees) / 2;
    } else if (offBos !== undefined) {
        financeScore = offBos;
    } else if (parentFeesRating !== undefined) {
        financeScore = 100 - parentFeesRating;
    }

    // Parent Satisfaction: parent-reported 'satisfaction' and 'communication'
    let satisfactionScore: number | null = null;
    const parentSat = avgPulse['satisfaction'];
    const parentComm = avgPulse['communication'];
    if (parentSat !== undefined && parentComm !== undefined) {
        satisfactionScore = (parentSat + parentComm) / 2;
    } else if (parentSat !== undefined) {
        satisfactionScore = parentSat;
    }

    // Student Welfare: parent-reported 'school_safety', 'bullying' (inverted), minus penalties for complaints
    let welfareScore: number | null = null;
    const parentSafety = avgPulse['school_safety'];
    const parentBullyRating = avgPulse['bullying']; // higher means bullying exists. Invert: 100 - rating
    
    const welfareComponents: number[] = [];
    if (parentSafety !== undefined) welfareComponents.push(parentSafety);
    if (parentBullyRating !== undefined) welfareComponents.push(100 - parentBullyRating);
    
    if (welfareComponents.length > 0) {
        let baseWelfare = welfareComponents.reduce((a, b) => a + b, 0) / welfareComponents.length;
        // Apply penalties for actual complaints
        baseWelfare -= (bullyingCount * 5) + (criticalSafetyCount * 15);
        welfareScore = Math.max(0, Math.min(100, baseWelfare));
    } else if (bullyingCount > 0 || criticalSafetyCount > 0) {
        // Fallback if no survey but complaints exist
        welfareScore = Math.max(0, 100 - (bullyingCount * 10) - (criticalSafetyCount * 30));
    }

    // Governance: official 'accreditation_score' or 'governance_rating'
    let govScore: number | null = null;
    if (officialMap['governance_rating'] !== undefined) {
        govScore = officialMap['governance_rating'];
    } else if (officialMap['accreditation_score'] !== undefined) {
        govScore = officialMap['accreditation_score'];
    }

    // 4. Calculate weighted composite score based on available dimensions
    const dimensions: { name: keyof DimensionBreakdown; score: number | null; weight: number }[] = [
        { name: 'academic', score: academicScore, weight: config.healthWeights.academic },
        { name: 'teacher', score: teacherScore, weight: config.healthWeights.teacher },
        { name: 'infrastructure', score: infraScore, weight: config.healthWeights.infrastructure },
        { name: 'finance', score: financeScore, weight: config.healthWeights.finance },
        { name: 'parentSatisfaction', score: satisfactionScore, weight: config.healthWeights.parentSatisfaction },
        { name: 'studentWelfare', score: welfareScore, weight: config.healthWeights.studentWelfare },
        { name: 'governance', score: govScore, weight: config.healthWeights.governance }
    ];

    let weightedSum = 0;
    let weightSum = 0;
    let availableCount = 0;

    dimensions.forEach(d => {
        if (d.score !== null) {
            weightedSum += d.score * d.weight;
            weightSum += d.weight;
            availableCount++;
        }
    });

    const compositeScore = weightSum > 0 ? parseFloat((weightedSum / weightSum).toFixed(2)) : 0;
    const completenessPct = parseFloat(((availableCount / 7) * 100).toFixed(2));
    const isProvisional = availableCount < 5;

    const breakdown: DimensionBreakdown = {
        academic: academicScore !== null ? parseFloat(academicScore.toFixed(2)) : null,
        teacher: teacherScore !== null ? parseFloat(teacherScore.toFixed(2)) : null,
        infrastructure: infraScore !== null ? parseFloat(infraScore.toFixed(2)) : null,
        finance: financeScore !== null ? parseFloat(financeScore.toFixed(2)) : null,
        parentSatisfaction: satisfactionScore !== null ? parseFloat(satisfactionScore.toFixed(2)) : null,
        studentWelfare: welfareScore !== null ? parseFloat(welfareScore.toFixed(2)) : null,
        governance: govScore !== null ? parseFloat(govScore.toFixed(2)) : null
    };

    // Save/Update in database
    await query(
        `INSERT INTO health_scores (school_id, period, composite_score, dimension_breakdown, completeness_pct, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
         ON CONFLICT (school_id, period) 
         DO UPDATE SET composite_score = EXCLUDED.composite_score, 
                       dimension_breakdown = EXCLUDED.dimension_breakdown, 
                       completeness_pct = EXCLUDED.completeness_pct,
                       updated_at = NOW()`,
        [schoolId, period, compositeScore, JSON.stringify(breakdown), completenessPct]
    );

    return {
        compositeScore,
        dimensionBreakdown: breakdown,
        completenessPct,
        isProvisional
    };
}
