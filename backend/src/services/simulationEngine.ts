import { query } from '../db';
import { config } from '../config';
import { calculateSchoolHealthScore, DimensionBreakdown } from './healthScore';

export interface SimulationResult {
    schoolId: string;
    interventionType: string;
    magnitude: number;
    originalComposite: number;
    projectedCompositeMin: number;
    projectedCompositeMax: number;
    originalBreakdown: DimensionBreakdown;
    projectedBreakdownMin: DimensionBreakdown;
    projectedBreakdownMax: DimensionBreakdown;
    coefficientBasis: string;
    assumption: string;
}

/**
 * Runs a policy simulation to project the impact of a proposed intervention.
 */
export async function runPolicySimulation(
    schoolId: string,
    interventionType: 'add_teachers' | 'increase_bos' | 'infrastructure_investment',
    magnitude: number,
    period: string
): Promise<SimulationResult> {
    // 1. Get the current school health score
    let originalComposite = 50;
    let originalBreakdown: DimensionBreakdown = {
        academic: 50,
        teacher: 50,
        infrastructure: 50,
        finance: 50,
        parentSatisfaction: 50,
        studentWelfare: 50,
        governance: 50
    };

    try {
        const hs = await calculateSchoolHealthScore(schoolId, period);
        originalComposite = hs.compositeScore;
        originalBreakdown = hs.dimensionBreakdown;
    } catch (e) {
        console.error('Error fetching current health score for simulation, using defaults', e);
    }

    // 2. Define coefficients and assumptions
    let coefficientBasis = '';
    let assumption = '';
    
    // Copy the original breakdown to project
    const projectedMin = { ...originalBreakdown };
    const projectedMax = { ...originalBreakdown };

    if (interventionType === 'add_teachers') {
        // Magnitude = number of teachers added (e.g. 2)
        // Dynamic coefficient: larger impact if the current score is low (diminishing marginal returns)
        const currentScore = originalBreakdown.teacher !== null ? originalBreakdown.teacher : 50;
        const deficiency = 100 - currentScore;
        const baseIncrease = magnitude * deficiency * 0.08;
        const minIncrease = Math.min(30, baseIncrease * 0.8);
        const maxIncrease = Math.min(30, baseIncrease * 1.2);

        if (projectedMin.teacher !== null) projectedMin.teacher = Math.min(100, projectedMin.teacher + minIncrease);
        if (projectedMax.teacher !== null) projectedMax.teacher = Math.min(100, projectedMax.teacher + maxIncrease);

        coefficientBasis = `Dynamic scaling: magnitude * (100 - currentTeacherScore) * 0.08 per teacher added (uncertainty range ±20%).`;
        assumption = `Adding teachers improves the student-to-teacher ratio and reduces class coverage gaps, leading to improved satisfaction and teacher attendance metrics.`;

    } else if (interventionType === 'increase_bos') {
        // Magnitude = percentage increase in BOS funding (e.g. 15 for 15%)
        const currentScore = originalBreakdown.finance !== null ? originalBreakdown.finance : 50;
        const deficiency = 100 - currentScore;
        const baseIncrease = magnitude * deficiency * 0.015;
        const minIncrease = Math.min(20, baseIncrease * 0.7);
        const maxIncrease = Math.min(20, baseIncrease * 1.3);

        // Affects finance and academic dimensions
        if (projectedMin.finance !== null) projectedMin.finance = Math.min(100, projectedMin.finance + minIncrease);
        if (projectedMax.finance !== null) projectedMax.finance = Math.min(100, projectedMax.finance + maxIncrease);
        if (projectedMin.academic !== null) projectedMin.academic = Math.min(100, projectedMin.academic + (minIncrease * 0.5));
        if (projectedMax.academic !== null) projectedMax.academic = Math.min(100, projectedMax.academic + (maxIncrease * 0.5));

        coefficientBasis = `Dynamic scaling: magnitude * (100 - currentFinanceScore) * 0.015 on Finance and 50% of that on Academic per 1% BOS funding increase (uncertainty range ±30%).`;
        assumption = `Increased operational funding (BOS) reduces the pressure to collect informal fees and provides budget for better learning facilities, classroom resources, and activities.`;

    } else if (interventionType === 'infrastructure_investment') {
        // Magnitude = IDR amount invested (e.g. 50,000,000)
        // Normalize by 1,000,000 IDR (e.g. 50 million -> 50)
        const normalizedMag = magnitude / 1000000;
        const currentScore = originalBreakdown.infrastructure !== null ? originalBreakdown.infrastructure : 50;
        const deficiency = 100 - currentScore;
        const baseIncrease = normalizedMag * deficiency * 0.005;
        const minIncrease = Math.min(25, baseIncrease * 0.6);
        const maxIncrease = Math.min(25, baseIncrease * 1.4);

        // Affects infrastructure and student welfare (safety)
        if (projectedMin.infrastructure !== null) projectedMin.infrastructure = Math.min(100, projectedMin.infrastructure + minIncrease);
        if (projectedMax.infrastructure !== null) projectedMax.infrastructure = Math.min(100, projectedMax.infrastructure + maxIncrease);
        if (projectedMin.studentWelfare !== null) projectedMin.studentWelfare = Math.min(100, projectedMin.studentWelfare + (minIncrease * 0.3));
        if (projectedMax.studentWelfare !== null) projectedMax.studentWelfare = Math.min(100, projectedMax.studentWelfare + (maxIncrease * 0.3));

        coefficientBasis = `Dynamic scaling: (investment / 1,000,000) * (100 - currentInfrastructureScore) * 0.005 on Infrastructure and 30% of that on Student Welfare per 1,000,000 IDR invested (uncertainty range ±40%).`;
        assumption = `Direct infrastructure capital injection enables the school to repair damaged roofs, upgrade sanitation, and secure dangerous perimeter fences.`;
    }

    // 3. Compute projected composite scores
    const dimensions: { name: keyof DimensionBreakdown; weight: number }[] = [
        { name: 'academic', weight: config.healthWeights.academic },
        { name: 'teacher', weight: config.healthWeights.teacher },
        { name: 'infrastructure', weight: config.healthWeights.infrastructure },
        { name: 'finance', weight: config.healthWeights.finance },
        { name: 'parentSatisfaction', weight: config.healthWeights.parentSatisfaction },
        { name: 'studentWelfare', weight: config.healthWeights.studentWelfare },
        { name: 'governance', weight: config.healthWeights.governance }
    ];

    let minWeightedSum = 0;
    let maxWeightedSum = 0;
    let weightSum = 0;

    dimensions.forEach(d => {
        const minScore = projectedMin[d.name];
        const maxScore = projectedMax[d.name];
        if (minScore !== null && maxScore !== null) {
            minWeightedSum += minScore * d.weight;
            maxWeightedSum += maxScore * d.weight;
            weightSum += d.weight;
        }
    });

    const projectedCompositeMin = weightSum > 0 ? parseFloat((minWeightedSum / weightSum).toFixed(2)) : 0;
    const projectedCompositeMax = weightSum > 0 ? parseFloat((maxWeightedSum / weightSum).toFixed(2)) : 0;

    return {
        schoolId,
        interventionType,
        magnitude,
        originalComposite,
        projectedCompositeMin,
        projectedCompositeMax,
        originalBreakdown,
        projectedBreakdownMin: projectedMin,
        projectedBreakdownMax: projectedMax,
        coefficientBasis,
        assumption
    };
}
