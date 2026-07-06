import { query } from '../db';
import { logAudit } from '../utils/auditLogger';

export interface NotificationPayload {
    to: string; // Phone number or Email
    message: string;
    type: 'WhatsApp' | 'SMS' | 'Push';
}

/**
 * Dispatch simulated notification to supervisors (BR-03 / BR-12)
 */
export async function dispatchSupervisorNotification(
    schoolId: string,
    complaintText: string,
    urgency: string
): Promise<void> {
    try {
        // 1. Get school details and its district
        const schoolQuery = await query('SELECT name, district FROM schools WHERE school_id = $1', [schoolId]);
        if (schoolQuery.rowCount === 0) return;
        const school = schoolQuery.rows[0];

        // 2. Find supervisors assigned to this district or 'All'
        const supervisorQuery = await query(
            `SELECT user_id, email, name FROM users 
             WHERE role = 'Supervisor' AND (district_scope = $1 OR district_scope = 'All') AND status = 'Active'`,
            [school.district]
        );

        if (supervisorQuery.rowCount === 0) {
            console.log(`[Notification Alert] No supervisor found for school [${school.name}] in district [${school.district}].`);
            return;
        }

        // 3. Dispatch simulated notification to each supervisor
        for (const supervisor of supervisorQuery.rows) {
            const shortText = complaintText.length > 60 ? complaintText.substring(0, 57) + '...' : complaintText;
            const message = `[EduPolicy Lab AI - WARNING] Critical Complaint Alert for school "${school.name}". Details: "${shortText}". Urgency: ${urgency}. Action required: Please review and log visit outcome immediately.`;

            // Simulating WhatsApp dispatch
            console.log(`\n==================================================`);
            console.log(`[SIMULATED DISPATCH] -> WhatsApp to Supervisor: ${supervisor.name} (${supervisor.email})`);
            console.log(`Message: ${message}`);
            console.log(`==================================================\n`);

            // Audit log for notification delivery (BR-03)
            await logAudit(null, 'DISPATCH_SUPERVISOR_NOTIFICATION', 'users', supervisor.user_id, {
                schoolName: school.name,
                district: school.district,
                recipientName: supervisor.name,
                recipientEmail: supervisor.email,
                channel: 'WhatsApp',
                message
            });
        }
    } catch (e) {
        console.error('Failed to dispatch supervisor notifications:', e);
    }
}
