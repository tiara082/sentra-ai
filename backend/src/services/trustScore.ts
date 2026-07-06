import { config } from '../config';

export type TrustTier = 'New' | 'Standard' | 'Trusted' | 'Under Review';

/**
 * Calculates the trust score and determines the tier of a parent.
 * Base score starts at 50.
 * 
 * NOTE ON ETHICAL AI & PRIVACY DESIGN:
 * To protect isolated victims (e.g., if only one child experiences bullying or infrastructure issues), 
 * statistical outliers in Parent Pulse survey ratings are NEVER automatically penalized or flagged as spam. 
 * Outliers are flagged solely for supervisor audit, while the parent's Trust Score remains intact 
 * unless there is explicit moderator-confirmed spam (spamFlagCount) or verified duplicate submissions (duplicateFlagCount).
 */
export function calculateParentTrust(
    validReportCount: number,
    spamFlagCount: number,
    duplicateFlagCount: number,
    identityVerified: boolean
): { trustScore: number; trustTier: TrustTier } {
    let score = 50;

    // 1. Valid reports bonus
    score += validReportCount * config.trustWeights.validReportBonus;

    // 2. Identity verification bonus
    if (identityVerified) {
        score += config.trustWeights.identityVerifiedBonus;
    }

    // 3. Penalties (Applied only on manual spam audits or verified identical duplicates)
    score += spamFlagCount * config.trustWeights.spamPenalty;
    score += duplicateFlagCount * config.trustWeights.duplicatePenalty;

    // Clamp score between 0 and 100
    const trustScore = Math.max(0, Math.min(100, score));

    // Determine tier
    let trustTier: TrustTier = 'Standard';
    if (spamFlagCount > 0 || trustScore <= 30) {
        trustTier = 'Under Review';
    } else if (validReportCount === 0 && !identityVerified) {
        trustTier = 'New';
    } else if (trustScore >= 80) {
        trustTier = 'Trusted';
    }

    return { trustScore, trustTier };
}
