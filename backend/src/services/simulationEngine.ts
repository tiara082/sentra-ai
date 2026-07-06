import { query } from '../db';
import { config } from '../config';
import { calculateSchoolHealthScore, DimensionBreakdown } from './healthScore';
import { getSimulationRationaleLLM } from './aiLLMService';

export interface SimulationResult {
    schoolId: string;
    schoolName?: string;
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
    
    // Copy the original breakdown to project
    const projectedMin = { ...originalBreakdown };
    const projectedMax = { ...originalBreakdown };

    if (interventionType === 'add_teachers') {
        const currentScore = originalBreakdown.teacher !== null ? originalBreakdown.teacher : 50;
        const deficiency = 100 - currentScore;
        const baseIncrease = magnitude * deficiency * 0.08;
        const minIncrease = Math.min(30, baseIncrease * 0.8);
        const maxIncrease = Math.min(30, baseIncrease * 1.2);

        if (projectedMin.teacher !== null) projectedMin.teacher = Math.min(100, projectedMin.teacher + minIncrease);
        if (projectedMax.teacher !== null) projectedMax.teacher = Math.min(100, projectedMax.teacher + maxIncrease);

    } else if (interventionType === 'increase_bos') {
        const currentScore = originalBreakdown.finance !== null ? originalBreakdown.finance : 50;
        const deficiency = 100 - currentScore;
        const baseIncrease = magnitude * deficiency * 0.015;
        const minIncrease = Math.min(20, baseIncrease * 0.7);
        const maxIncrease = Math.min(20, baseIncrease * 1.3);

        if (projectedMin.finance !== null) projectedMin.finance = Math.min(100, projectedMin.finance + minIncrease);
        if (projectedMax.finance !== null) projectedMax.finance = Math.min(100, projectedMax.finance + maxIncrease);
        if (projectedMin.academic !== null) projectedMin.academic = Math.min(100, projectedMin.academic + (minIncrease * 0.5));
        if (projectedMax.academic !== null) projectedMax.academic = Math.min(100, projectedMax.academic + (maxIncrease * 0.5));

    } else if (interventionType === 'infrastructure_investment') {
        const normalizedMag = magnitude / 1000000;
        const currentScore = originalBreakdown.infrastructure !== null ? originalBreakdown.infrastructure : 50;
        const deficiency = 100 - currentScore;
        const baseIncrease = normalizedMag * deficiency * 0.005;
        const minIncrease = Math.min(25, baseIncrease * 0.6);
        const maxIncrease = Math.min(25, baseIncrease * 1.4);

        if (projectedMin.infrastructure !== null) projectedMin.infrastructure = Math.min(100, projectedMin.infrastructure + minIncrease);
        if (projectedMax.infrastructure !== null) projectedMax.infrastructure = Math.min(100, projectedMax.infrastructure + maxIncrease);
        if (projectedMin.studentWelfare !== null) projectedMin.studentWelfare = Math.min(100, projectedMin.studentWelfare + (minIncrease * 0.3));
        if (projectedMax.studentWelfare !== null) projectedMax.studentWelfare = Math.min(100, projectedMax.studentWelfare + (maxIncrease * 0.3));
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

    // Fetch School Name for LLM Context
    let schoolName = 'Sekolah';
    try {
        const sQuery = await query('SELECT name FROM schools WHERE school_id = $1', [schoolId]);
        if (sQuery.rows.length > 0) {
            schoolName = sQuery.rows[0].name;
        }
    } catch (e) {
        console.error(e);
    }

    // Call the universal AI LLM service for rationale & assumption
    const { rationale, assumption } = await getSimulationRationaleLLM(
        schoolName,
        interventionType,
        magnitude,
        originalComposite,
        projectedCompositeMin,
        projectedCompositeMax
    );

    return {
        schoolId,
        schoolName,
        interventionType,
        magnitude,
        originalComposite,
        projectedCompositeMin,
        projectedCompositeMax,
        originalBreakdown,
        projectedBreakdownMin: projectedMin,
        projectedBreakdownMax: projectedMax,
        coefficientBasis: rationale,
        assumption
    };
}
