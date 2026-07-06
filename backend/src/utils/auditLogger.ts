import { query } from '../db';

/**
 * Utility to write logs to the audit_logs table
 */
export async function logAudit(
    actorId: string | null,
    action: string,
    targetEntity: string,
    targetId: string | null = null,
    metadata: Record<string, any> = {}
): Promise<void> {
    try {
        await query(
            `INSERT INTO audit_logs (actor_id, action, target_entity, target_id, timestamp, metadata)
             VALUES ($1, $2, $3, $4, NOW(), $5::jsonb)`,
            [actorId, action, targetEntity, targetId, JSON.stringify(metadata)]
        );
    } catch (e) {
        console.error('Failed to write audit log:', e);
    }
}
