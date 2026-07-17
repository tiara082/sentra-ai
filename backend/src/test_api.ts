
const BASE_URL = 'http://localhost:8000/api/v1';
const HEALTH_URL = 'http://localhost:8000/health';

async function runTests() {
    console.log('==================================================');
    console.log('         STARTING SENTRA-AI FULLSTACK TESTS       ');
    console.log('==================================================\n');

    let analystToken = '';
    let principalToken = '';
    let parentToken = '';
    let realSchoolId = '';
    let otherSchoolId = '';

    // 1. Health Check
    try {
        const res = await fetch(HEALTH_URL);
        const data = await res.json() as any;
        console.log(`[PASS] GET /health => status: ${res.status}, body: ${JSON.stringify(data)}`);
    } catch (e: any) {
        console.log(`[FAIL] GET /health => Error: ${e.message}`);
    }

    // 2. Auth - Staff Login (Analyst)
    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'bu_rina@edupolicy.go.id',
                password: 'Password123'
            })
        });
        const data = await res.json() as any;
        if (res.status === 200 && data.token) {
            analystToken = data.token;
            console.log(`[PASS] POST /auth/login (Analyst) => HTTP ${res.status}, role: ${data.role}`);
        } else {
            console.log(`[FAIL] POST /auth/login (Analyst) => HTTP ${res.status}, body: ${JSON.stringify(data)}`);
        }
    } catch (e: any) {
        console.log(`[FAIL] POST /auth/login (Analyst) => Error: ${e.message}`);
    }

    // 3. Auth - Staff Login (Principal)
    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'bu_sari@edupolicy.go.id',
                password: 'Password123'
            })
        });
        const data = await res.json() as any;
        if (res.status === 200 && data.token) {
            principalToken = data.token;
            console.log(`[PASS] POST /auth/login (Principal) => HTTP ${res.status}, role: ${data.role}`);
        } else {
            console.log(`[FAIL] POST /auth/login (Principal) => HTTP ${res.status}, body: ${JSON.stringify(data)}`);
        }
    } catch (e: any) {
        console.log(`[FAIL] POST /auth/login (Principal) => Error: ${e.message}`);
    }

    // 4. Auth - Login Incorrect Password
    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'bu_rina@edupolicy.go.id',
                password: 'WrongPassword!!!'
            })
        });
        if (res.status === 401) {
            console.log(`[PASS] POST /auth/login (Bad Pass) => Correctly rejected with HTTP ${res.status}`);
        } else {
            console.log(`[WARN] POST /auth/login (Bad Pass) => Expected HTTP 401, got ${res.status}`);
        }
    } catch (e: any) {
        console.log(`[FAIL] POST /auth/login (Bad Pass) => Error: ${e.message}`);
    }

    // 5. Get Schools List & Extract Real School ID
    if (analystToken) {
        try {
            const res = await fetch(`${BASE_URL}/schools`, {
                headers: { 'Authorization': `Bearer ${analystToken}` }
            });
            const data = await res.json() as any;
            if (res.status === 200 && Array.isArray(data) && data.length > 0) {
                realSchoolId = data[0].school_id;
                if (data.length > 1) {
                    otherSchoolId = data[1].school_id;
                }
                console.log(`[PASS] GET /schools => HTTP ${res.status}, found ${data.length} schools. First School ID: ${realSchoolId}`);
            } else {
                console.log(`[FAIL] GET /schools => HTTP ${res.status}, body: ${JSON.stringify(data)}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] GET /schools => Error: ${e.message}`);
        }
    }

    // 6. Parent Registration (PDP / Consent flow)
    if (realSchoolId) {
        try {
            const res = await fetch(`${BASE_URL}/parents/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: '081234567890',
                    schoolId: realSchoolId,
                    consentStatus: true
                })
            });
            const data = await res.json() as any;
            if (res.status === 200 && data.token) {
                parentToken = data.token;
                console.log(`[PASS] POST /parents/register => HTTP ${res.status}, token received`);
            } else {
                console.log(`[FAIL] POST /parents/register => HTTP ${res.status}, body: ${JSON.stringify(data)}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] POST /parents/register => Error: ${e.message}`);
        }
    }

    // 7. Parent Pulse Submission (Valid & Duplicate validation)
    if (parentToken && realSchoolId) {
        // Submit valid survey
        try {
            const res = await fetch(`${BASE_URL}/parent-pulse/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${parentToken}`
                },
                body: JSON.stringify({
                    schoolId: realSchoolId,
                    period: '2026-07',
                    topicScores: {
                        teacher_attendance: 5,
                        cleanliness: 4,
                        bullying: 5,
                        facilities: 3,
                        learning_quality: 4,
                        communication: 4,
                        school_safety: 5,
                        illegal_fees: 5,
                        satisfaction: 4
                    },
                    freeText: 'Sekolah ini sangat aman dan guru-gurunya berdedikasi tinggi.'
                })
            });
            const data = await res.json() as any;
            if (res.status === 200) {
                console.log(`[PASS] POST /parent-pulse/submit (Valid) => HTTP ${res.status}: ${data.message}`);
            } else {
                console.log(`[FAIL] POST /parent-pulse/submit (Valid) => HTTP ${res.status}, body: ${JSON.stringify(data)}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] POST /parent-pulse/submit (Valid) => Error: ${e.message}`);
        }

        // Submit duplicate survey (BR-01 constraint check)
        try {
            const res = await fetch(`${BASE_URL}/parent-pulse/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${parentToken}`
                },
                body: JSON.stringify({
                    schoolId: realSchoolId,
                    period: '2026-07', // Same period
                    topicScores: {
                        teacher_attendance: 5,
                        cleanliness: 4,
                        bullying: 5,
                        facilities: 3,
                        learning_quality: 4,
                        communication: 4,
                        school_safety: 5,
                        illegal_fees: 5,
                        satisfaction: 4
                    }
                })
            });
            const data = await res.json() as any;
            if (res.status === 400 && data.error_code === 'DUPLICATE_SUBMISSION') {
                console.log(`[PASS] POST /parent-pulse/submit (Duplicate Check) => Correctly blocked with HTTP 400 (DUPLICATE_SUBMISSION)`);
            } else {
                console.log(`[WARN] POST /parent-pulse/submit (Duplicate Check) => Expected HTTP 400 DUPLICATE_SUBMISSION, got HTTP ${res.status}. Body: ${JSON.stringify(data)}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] POST /parent-pulse/submit (Duplicate Check) => Error: ${e.message}`);
        }
    }

    // 8. Ad-hoc Complaint Submission (Valid, Invalid Length, Cross-school)
    if (parentToken && realSchoolId) {
        // Valid Complaint
        try {
            const res = await fetch(`${BASE_URL}/complaints`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${parentToken}`
                },
                body: JSON.stringify({
                    schoolId: realSchoolId,
                    text: 'Fasilitas perpustakaan sekolah kurang terawat, banyak buku robek dan tidak disusun rapi.',
                    isFullyAnonymous: false
                })
            });
            const data = await res.json() as any;
            if (res.status === 201) {
                console.log(`[PASS] POST /complaints (Valid) => HTTP ${res.status}, complaintId: ${data.complaintId}`);
            } else {
                console.log(`[FAIL] POST /complaints (Valid) => HTTP ${res.status}, body: ${JSON.stringify(data)}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] POST /complaints (Valid) => Error: ${e.message}`);
        }

        // Short complaint (<20 chars)
        try {
            const res = await fetch(`${BASE_URL}/complaints`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${parentToken}`
                },
                body: JSON.stringify({
                    schoolId: realSchoolId,
                    text: 'Jelek bgt',
                    isFullyAnonymous: false
                })
            });
            const data = await res.json() as any;
            if (res.status === 400 && data.error_code === 'INVALID_TEXT_LENGTH') {
                console.log(`[PASS] POST /complaints (Short Text) => Correctly rejected with HTTP 400 (INVALID_TEXT_LENGTH)`);
            } else {
                console.log(`[WARN] POST /complaints (Short Text) => Expected HTTP 400, got HTTP ${res.status}. Body: ${JSON.stringify(data)}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] POST /complaints (Short Text) => Error: ${e.message}`);
        }

        // Cross-school complaint (Parent trying to file a complaint for a school they aren't linked to)
        if (otherSchoolId) {
            try {
                const res = await fetch(`${BASE_URL}/complaints`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${parentToken}`
                    },
                    body: JSON.stringify({
                        schoolId: otherSchoolId,
                        text: 'Mencoba mengirimkan keluhan untuk sekolah yang berbeda dari registrasi saya.',
                        isFullyAnonymous: false
                    })
                });
                const data = await res.json() as any;
                if (res.status === 403 && data.error_code === 'FORBIDDEN') {
                    console.log(`[PASS] POST /complaints (Cross-School Check) => Correctly blocked with HTTP 403 (FORBIDDEN)`);
                } else {
                    console.log(`[WARN] POST /complaints (Cross-School Check) => Expected HTTP 403 FORBIDDEN, got HTTP ${res.status}. Body: ${JSON.stringify(data)}`);
                }
            } catch (e: any) {
                console.log(`[FAIL] POST /complaints (Cross-School Check) => Error: ${e.message}`);
            }
        }
    }

    // 9. Simulation Tool
    if (analystToken && realSchoolId) {
        try {
            const res = await fetch(`${BASE_URL}/simulations/run`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${analystToken}`
                },
                body: JSON.stringify({
                    schoolId: realSchoolId,
                    interventionType: 'add_teachers',
                    magnitude: 4
                })
            });
            const data = await res.json() as any;
            if (res.status === 200 && data.projectedScore !== undefined) {
                console.log(`[PASS] POST /simulations/run => HTTP ${res.status}, projectedScore: ${data.projectedScore}`);
            } else {
                console.log(`[FAIL] POST /simulations/run => HTTP ${res.status}, body: ${JSON.stringify(data)}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] POST /simulations/run => Error: ${e.message}`);
        }
    }

    // 10. Security: CORS Wildcard Check
    try {
        const res = await fetch(HEALTH_URL, {
            headers: { 'Origin': 'http://malicious-website.com' }
        });
        const corsHeader = res.headers.get('access-control-allow-origin');
        if (corsHeader === '*') {
            console.log(`[VULN] CORS Header 'Access-Control-Allow-Origin' is set to '*' (Accepts all origins)`);
        } else if (corsHeader === 'http://malicious-website.com') {
            console.log(`[VULN] CORS dynamically reflects untrusted Origin header: ${corsHeader}`);
        } else {
            console.log(`[PASS] CORS Header is properly secure or omitted for untrusted origins: ${corsHeader}`);
        }
    } catch (e: any) {
        console.log(`[FAIL] CORS Check => Error: ${e.message}`);
    }

    // 11. Security: JWT Signature Tampering
    if (realSchoolId) {
        try {
            // Take the analyst token, modify the payload/signature slightly
            const parts = analystToken.split('.');
            if (parts.length === 3) {
                // Change the signature part slightly to simulate tampered signature
                const tamperedToken = `${parts[0]}.${parts[1]}.ThisIsAFakeSignature1234567890`;
                const res = await fetch(`${BASE_URL}/schools`, {
                    headers: { 'Authorization': `Bearer ${tamperedToken}` }
                });
                if (res.status === 401) {
                    console.log(`[PASS] JWT Tampering Check => Properly rejected tampered token with HTTP ${res.status}`);
                } else {
                    console.log(`[VULN] JWT Tampering Check => FAILED to reject tampered token! Returned HTTP ${res.status}`);
                }
            } else {
                console.log(`[WARN] JWT Tampering Check => Could not parse analyst token structure`);
            }
        } catch (e: any) {
            console.log(`[FAIL] JWT Tampering Check => Error: ${e.message}`);
        }
    }

    // 12. Security: RBAC Privilege Escalation Check
    // A Parent token (or Principal token) trying to access Analyst routes (e.g. GET /schools or GET /audit-logs)
    if (parentToken) {
        try {
            const res = await fetch(`${BASE_URL}/schools`, {
                headers: { 'Authorization': `Bearer ${parentToken}` }
            });
            const data = await res.json() as any;
            if (res.status === 403 || res.status === 401) {
                console.log(`[PASS] Privilege Escalation (Parent -> Analyst Route) => Correctly blocked with HTTP ${res.status}`);
            } else {
                console.log(`[VULN] Privilege Escalation (Parent -> Analyst Route) => Parent token allowed access to GET /schools! HTTP ${res.status}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] Privilege Escalation Check => Error: ${e.message}`);
        }
    }

    if (principalToken) {
        try {
            const res = await fetch(`${BASE_URL}/alerts`, {
                headers: { 'Authorization': `Bearer ${principalToken}` }
            });
            if (res.status === 403 || res.status === 401) {
                console.log(`[PASS] Privilege Escalation (Principal -> Alerts Route) => Correctly blocked with HTTP ${res.status}`);
            } else {
                console.log(`[VULN] Privilege Escalation (Principal -> Alerts Route) => Principal token allowed access to GET /alerts! HTTP ${res.status}`);
            }
        } catch (e: any) {
            console.log(`[FAIL] Privilege Escalation Check => Error: ${e.message}`);
        }
    }

    // 13. Rate Limiting Check (burst request validation)
    try {
        let count429 = 0;
        const requests = Array.from({ length: 25 }, () => fetch(HEALTH_URL));
        const responses = await Promise.all(requests);
        for (const r of responses) {
            if (r.status === 429) {
                count429++;
            }
        }
        if (count429 > 0) {
            console.log(`[PASS] Rate Limiting => Detected. ${count429} requests rejected with HTTP 429 (Too Many Requests).`);
        } else {
            console.log(`[WARN] Rate Limiting => NOT detected. All 25 concurrent requests succeeded with HTTP 200.`);
        }
    } catch (e: any) {
        console.log(`[FAIL] Rate Limiting Check => Error: ${e.message}`);
    }

    console.log('\n==================================================');
    console.log('             SENTRA-AI TESTS COMPLETED            ');
    console.log('==================================================');
}

runTests();
