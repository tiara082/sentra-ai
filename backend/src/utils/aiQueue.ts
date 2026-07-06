import { query, transaction } from '../db';
import { detectDuplicate } from '../services/aiComplaints';
import { dispatchSupervisorNotification } from '../services/notificationService';
import { calculateParentTrust } from '../services/trustScore';
import { analyzeComplaintLLM } from '../services/aiLLMService';

interface AIJob {
    complaintId: string;
    schoolId: string;
    text: string; // decrypted plaintext
    parentId: string | null;
}

class AIProcessingQueue {
    private queue: AIJob[] = [];
    private processing = false;

    /**
     * Adds a new AI classification/analysis job to the queue
     */
    public addJob(job: AIJob) {
        this.queue.push(job);
        this.processNext();
    }

    private async processNext() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const job = this.queue.shift()!;
        try {
            console.log(`[AI Queue] Processing job for complaint ID: ${job.complaintId}`);
            
            // Get school name for context
            let schoolName = 'Sekolah';
            const schoolRes = await query('SELECT name FROM schools WHERE school_id = $1', [job.schoolId]);
            if (schoolRes.rows.length > 0) {
                schoolName = schoolRes.rows[0].name;
            }

            // Run AI Complaint Intelligence pipeline (LLM + local fallbacks)
            const enrichment = await analyzeComplaintLLM(job.text, schoolName);
            const { isDuplicate, duplicateOfId } = await detectDuplicate(job.text, job.schoolId, enrichment.category);

            await transaction(async (client) => {
                // 1. Update Complaint with computed AI values
                await client.query(
                    `UPDATE complaints 
                     SET category = $1, urgency = $2, sentiment = $3
                     WHERE complaint_id = $4`,
                    [enrichment.category, enrichment.urgency, enrichment.sentiment, job.complaintId]
                );

                // 2. Update AI Metadata (including explanation and suggested_response)
                await client.query(
                    `UPDATE complaint_ai_metadata
                     SET confidence = 0.95, duplicate_of_id = $1, explanation = $2, suggested_response = $3
                     WHERE complaint_id = $4`,
                    [duplicateOfId, enrichment.explanation, enrichment.suggestedResponse, job.complaintId]
                );

                // 3. Trigger alert for Critical urgency reports immediately (BR-03)
                if (urgency === 'Critical') {
                    await client.query(
                        `INSERT INTO risk_alerts (school_id, trigger_type, severity, status)
                         VALUES ($1, 'Critical Complaint Alert', 'Critical', 'Open')`,
                        [job.schoolId]
                    );
                }

                // 4. Update parent history if duplicate was detected (penalize duplicate count)
                if (isDuplicate && job.parentId) {
                    await client.query(
                        `UPDATE parents SET duplicate_flag_count = duplicate_flag_count + 1 WHERE parent_id = $1`,
                        [job.parentId]
                    );
                    
                    // Recalculate parent trust
                    const pQuery = await client.query('SELECT * FROM parents WHERE parent_id = $1', [job.parentId]);
                    const p = pQuery.rows[0];
                    const trust = calculateParentTrust(p.valid_report_count, p.spam_flag_count, p.duplicate_flag_count, p.identity_verified);
                    await client.query(
                        'UPDATE parents SET trust_score = $1, trust_tier = $2 WHERE parent_id = $3',
                        [trust.trustScore, trust.trustTier, job.parentId]
                    );
                }
            });

            // Trigger notification if Critical (BR-03 / BR-12)
            if (urgency === 'Critical') {
                dispatchSupervisorNotification(job.schoolId, job.text, urgency).catch(err => 
                    console.error('[AI Queue] Failed to send critical supervisor notification:', err)
                );
            }

            console.log(`[AI Queue] Successfully processed complaint ID: ${job.complaintId}`);

        } catch (e) {
            console.error(`[AI Queue] Error processing complaint ID ${job.complaintId}:`, e);
        } finally {
            this.processing = false;
            this.processNext();
        }
    }
}

export const aiQueue = new AIProcessingQueue();
