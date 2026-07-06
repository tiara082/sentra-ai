import { query, transaction } from './db';
import { hashPassword } from './security';
import { detectGroundTruthGaps } from './services/groundTruth';
import { encryptText } from './utils/crypto';
import fs from 'fs';
import path from 'path';

async function seed() {
    console.log('Starting database seeding...');
    const hashedPass = await hashPassword('Password123');

    // Load complaints dataset
    const complaintsData = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../data/government_education_complaints.json'), 'utf8')
    );

    try {
        await transaction(async (client) => {
            // 1. Clear existing data in correct order
            console.log('Clearing old data...');
            await client.query('TRUNCATE audit_logs, recommendations, simulations, risk_alerts, ground_truth_flags, health_scores, complaint_ai_metadata, complaints, parent_pulse_responses, parent_schools, parents, official_indicators, users, schools CASCADE');

            // 2. Insert Users
            console.log('Seeding users...');
            const adminRes = await client.query(
                `INSERT INTO users (email, name, password_hash, role, district_scope)
                 VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
                ['admin@edupolicy.go.id', 'System Admin', hashedPass, 'Admin', 'All']
            );
            
            const rinaRes = await client.query(
                `INSERT INTO users (email, name, password_hash, role, district_scope)
                 VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
                ['bu_rina@edupolicy.go.id', 'Bu Rina', hashedPass, 'Dinas Analyst', 'All']
            );

            const hermanRes = await client.query(
                `INSERT INTO users (email, name, password_hash, role, district_scope)
                 VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
                ['pak_herman@edupolicy.go.id', 'Pak Herman', hashedPass, 'Supervisor', 'Kecamatan Lowokwaru']
            );

            const complianceRes = await client.query(
                `INSERT INTO users (email, name, password_hash, role, district_scope)
                 VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
                ['compliance@edupolicy.go.id', 'Compliance Officer', hashedPass, 'Compliance Officer', 'All']
            );

            // 3. Seed Schools (with real East Java NPSNs)
            console.log('Seeding schools...');
            const schools = [
                // Kota Malang
                { name: 'SDN Lowokwaru 1', npsn: '20534013', district: 'Kecamatan Lowokwaru', lat: -7.9432, lng: 112.6215, cluster: 1 },
                { name: 'SDN Lowokwaru 2', npsn: '20534014', district: 'Kecamatan Lowokwaru', lat: -7.9455, lng: 112.6230, cluster: 1 },
                { name: 'SMPN 18 Malang', npsn: '20533791', district: 'Kecamatan Lowokwaru', lat: -7.9410, lng: 112.6201, cluster: 1 },
                { name: 'SDN Klojen 1', npsn: '20534080', district: 'Kecamatan Klojen', lat: -7.9782, lng: 112.6291, cluster: 1 },
                { name: 'SDN Klojen 2', npsn: '20534079', district: 'Kecamatan Klojen', lat: -7.9790, lng: 112.6310, cluster: 1 },
                { name: 'SMPN 1 Malang', npsn: '20533965', district: 'Kecamatan Klojen', lat: -7.9750, lng: 112.6280, cluster: 1 },
                { name: 'SDN Blimbing 1', npsn: '20534120', district: 'Kecamatan Blimbing', lat: -7.9351, lng: 112.6450, cluster: 2 },
                { name: 'SDN Blimbing 2', npsn: '20534119', district: 'Kecamatan Blimbing', lat: -7.9372, lng: 112.6482, cluster: 2 },
                { name: 'SMPN 3 Malang', npsn: '20533963', district: 'Kecamatan Blimbing', lat: -7.9310, lng: 112.6410, cluster: 2 },
                // Kota Surabaya
                { name: 'SDN Kertajaya', npsn: '20532671', district: 'Kota Surabaya', lat: -7.2758, lng: 112.7634, cluster: 1 },
                { name: 'SDN Baratajaya', npsn: '20532729', district: 'Kota Surabaya', lat: -7.2882, lng: 112.7547, cluster: 1 },
                { name: 'SMPN 1 Surabaya', npsn: '20532551', district: 'Kota Surabaya', lat: -7.2562, lng: 112.7410, cluster: 1 },
                // Kabupaten Sidoarjo
                { name: 'SDN Sidoarjo 1', npsn: '20501861', district: 'Kabupaten Sidoarjo', lat: -7.4478, lng: 112.7183, cluster: 1 },
                { name: 'SMPN 1 Sidoarjo', npsn: '20501550', district: 'Kabupaten Sidoarjo', lat: -7.4461, lng: 112.7135, cluster: 1 },
                // Kabupaten Gresik
                { name: 'SDN 1 Gresik', npsn: '20500123', district: 'Kabupaten Gresik', lat: -7.1612, lng: 112.6565, cluster: 1 },
                { name: 'SMPN 1 Gresik', npsn: '20500450', district: 'Kabupaten Gresik', lat: -7.1590, lng: 112.6510, cluster: 1 },
                // Kabupaten Banyuwangi
                { name: 'SDN 1 Banyuwangi', npsn: '20525123', district: 'Kabupaten Banyuwangi', lat: -8.2192, lng: 114.3692, cluster: 2 },
                { name: 'SMPN 1 Banyuwangi', npsn: '20525450', district: 'Kabupaten Banyuwangi', lat: -8.2140, lng: 114.3645, cluster: 2 },
                // Kabupaten Jember
                { name: 'SDN 1 Jember', npsn: '20523123', district: 'Kabupaten Jember', lat: -8.1722, lng: 113.7022, cluster: 2 },
                { name: 'SMPN 1 Jember', npsn: '20523450', district: 'Kabupaten Jember', lat: -8.1690, lng: 113.6985, cluster: 2 },
                // Kota Kediri
                { name: 'SDN Kediri 1', npsn: '20535123', district: 'Kota Kediri', lat: -7.8172, lng: 112.0123, cluster: 1 },
                { name: 'SMPN 1 Kediri', npsn: '20535450', district: 'Kota Kediri', lat: -7.8140, lng: 112.0085, cluster: 1 },
                // Kota Madiun
                { name: 'SDN Madiun 1', npsn: '20537123', district: 'Kota Madiun', lat: -7.6292, lng: 111.5234, cluster: 1 },
                { name: 'SMPN 1 Madiun', npsn: '20537450', district: 'Kota Madiun', lat: -7.6250, lng: 111.5190, cluster: 1 }
            ];

            const schoolIdsMap: Record<string, string> = {};

            for (const s of schools) {
                const sRes = await client.query(
                    `INSERT INTO schools (name, npsn, district, geo_lat, geo_lng, cluster_id)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING school_id`,
                    [s.name, s.npsn, s.district, s.lat, s.lng, s.cluster]
                );
                schoolIdsMap[s.name] = sRes.rows[0].school_id;
            }

            // Create Principal user and link to SDN Lowokwaru 1
            console.log('Seeding Principal...');
            const schoolAId = schoolIdsMap['SDN Lowokwaru 1'];
            await client.query(
                `INSERT INTO users (email, name, password_hash, role, district_scope)
                 VALUES ($1, $2, $3, $4, $5)`,
                ['bu_sari@edupolicy.go.id', 'Bu Sari', hashedPass, 'Principal', schoolAId]
            );

            // 4. Seed Official Indicators for all schools (Period 2026-07)
            console.log('Seeding official indicators...');
            const indicatorFields = [
                { field: 'academic_performance', val: 78.5 },
                { field: 'teacher_attendance', val: 98.0 }, // high official attendance
                { field: 'infrastructure_condition', val: 82.0 },
                { field: 'bos_compliance', val: 90.0 },
                { field: 'governance_rating', val: 85.0 }
            ];

            for (const [name, id] of Object.entries(schoolIdsMap)) {
                for (const ind of indicatorFields) {
                    await client.query(
                        `INSERT INTO official_indicators (school_id, source, period, field, value)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [id, 'dapodik', '2026-07', ind.field, ind.val]
                    );
                }
            }

            // 5. Seed Parents for SDN Lowokwaru 1 (to satisfy BR-04 we need 15+ responses)
            console.log('Seeding parents and survey responses for SDN Lowokwaru 1...');
            
            // We will seed 16 parents
            for (let i = 1; i <= 16; i++) {
                const phone = `0812345678${i.toString().padStart(2, '0')}`;
                // Sha256 hash
                const phoneHash = crypto.createHash('sha256').update(phone).digest('hex');
                
                const pRes = await client.query(
                    `INSERT INTO parents (phone_hash, consent_status, trust_score, trust_tier, identity_verified)
                     VALUES ($1, TRUE, 75, 'Standard', TRUE) RETURNING parent_id`,
                    [phoneHash]
                );
                const parentId = pRes.rows[0].parent_id;

                // Link parent to SDN Lowokwaru 1
                await client.query(
                    `INSERT INTO parent_schools (parent_id, school_id) VALUES ($1, $2)`,
                    [parentId, schoolAId]
                );

                // Insert survey response
                // For SDN Lowokwaru 1, we want the parent-reported teacher attendance to be low (e.g. 2 out of 5)
                // to create an anomaly gap against the official 98%
                const topicScores = {
                    teacher_attendance: 2, // low attendance
                    cleanliness: 4,
                    bullying: 1, // low bullying (good)
                    facilities: 3,
                    learning_quality: 4,
                    communication: 4,
                    school_safety: 4,
                    illegal_fees: 1, // low fees (good)
                    satisfaction: 3
                };

                await client.query(
                    `INSERT INTO parent_pulse_responses (parent_id, school_id, period, topic_scores, free_text)
                     VALUES ($1, $2, $3, $4::jsonb, $5)`,
                    [parentId, schoolAId, '2026-07', JSON.stringify(topicScores), encryptText(`Komentar parent ke-${i}`)]
                );
            }

            // Seed a few survey responses for other schools (less than 15, so no flags are triggered for them)
            const schoolBId = schoolIdsMap['SDN Lowokwaru 2'];
            for (let i = 17; i <= 20; i++) {
                const phone = `0812345678${i}`;
                const phoneHash = crypto.createHash('sha256').update(phone).digest('hex');
                const pRes = await client.query(
                    `INSERT INTO parents (phone_hash, consent_status, trust_score, trust_tier, identity_verified)
                     VALUES ($1, TRUE, 75, 'Standard', TRUE) RETURNING parent_id`,
                    [phoneHash]
                );
                const parentId = pRes.rows[0].parent_id;
                
                await client.query(
                    `INSERT INTO parent_schools (parent_id, school_id) VALUES ($1, $2)`,
                    [parentId, schoolBId]
                );

                const topicScores = {
                    teacher_attendance: 5,
                    cleanliness: 5,
                    bullying: 1,
                    facilities: 4,
                    learning_quality: 5,
                    communication: 5,
                    school_safety: 5,
                    illegal_fees: 1,
                    satisfaction: 5
                };

                await client.query(
                    `INSERT INTO parent_pulse_responses (parent_id, school_id, period, topic_scores, free_text)
                     VALUES ($1, $2, $3, $4::jsonb, $5)`,
                    [parentId, schoolBId, '2026-07', JSON.stringify(topicScores), encryptText('Sekolah ini sangat bagus!')]
                );
            }

            // 6. Seed training complaints from JSON
            console.log('Seeding complaints training dataset from government data...');
            const schoolIds = Object.values(schoolIdsMap);

            // Seed Category training complaints
            for (let i = 0; i < complaintsData.category_complaints.length; i++) {
                const item = complaintsData.category_complaints[i];
                const schoolId = schoolIds[i % schoolIds.length];

                const cRes = await client.query(
                    `INSERT INTO complaints (school_id, text, category, urgency, sentiment, status)
                     VALUES ($1, $2, $3, 'Low', NULL, 'Resolved')
                     RETURNING complaint_id`,
                    [schoolId, encryptText(item.text), item.label]
                );
                const complaintId = cRes.rows[0].complaint_id;

                await client.query(
                    `INSERT INTO complaint_ai_metadata (complaint_id, model_version, confidence, review_status)
                     VALUES ($1, 'initial', 1.0, 'Confirmed')`,
                    [complaintId]
                );
            }

            // Seed Sentiment training complaints
            for (let i = 0; i < complaintsData.sentiment_complaints.length; i++) {
                const item = complaintsData.sentiment_complaints[i];
                const schoolId = schoolIds[i % schoolIds.length];

                const cRes = await client.query(
                    `INSERT INTO complaints (school_id, text, category, urgency, sentiment, status)
                     VALUES ($1, $2, NULL, 'Low', $3, 'Resolved')
                     RETURNING complaint_id`,
                    [schoolId, encryptText(item.text), item.label]
                );
                const complaintId = cRes.rows[0].complaint_id;

                await client.query(
                    `INSERT INTO complaint_ai_metadata (complaint_id, model_version, confidence, review_status)
                     VALUES ($1, 'initial', 1.0, 'Confirmed')`,
                    [complaintId]
                );
            }

            console.log('Seeding finished successfully.');
        });

        console.log('Running initial Ground Truth gap detection...');
        await detectGroundTruthGaps('2026-07');
        console.log('Ground truth detection complete.');
    } catch (e) {
        console.error('Seeding transaction failed:', e);
        throw e;
    }
}

// Support running directly
import crypto from 'crypto';
if (require.main === module) {
    seed()
        .then(() => {
            console.log('Seed execution complete.');
            process.exit(0);
        })
        .catch(err => {
            console.error('Seed execution error:', err);
            process.exit(1);
        });
}
