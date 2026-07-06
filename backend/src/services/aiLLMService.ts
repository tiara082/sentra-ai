export interface SimulationRationale {
    rationale: string;
    assumption: string;
}

export interface ComplaintAIEnrichment {
    category: string;
    urgency: string;
    sentiment: string;
    explanation: string;
    suggestedResponse: string;
}

/**
 * Generates context-aware, professional Indonesian policy rationales.
 */
export async function getSimulationRationaleLLM(
    schoolName: string,
    interventionType: string,
    magnitude: number,
    originalComposite: number,
    projectedMin: number,
    projectedMax: number
): Promise<SimulationRationale> {
    const prompt = `Anda adalah analis ahli kebijakan pendidikan Kementerian Pendidikan.
Tuliskan penjelasan ilmiah (rationale) dan asumsi model (assumption) dalam bahasa Indonesia yang sangat profesional dan formal untuk simulasi kebijakan berikut:
Nama Sekolah: ${schoolName}
Jenis Intervensi: ${interventionType}
Besaran Magnitude: ${magnitude}
Skor Awal Kesehatan Sekolah: ${originalComposite.toFixed(1)}/100
Skor Proyeksi Komposit Baru: [${projectedMin.toFixed(1)} - ${projectedMax.toFixed(1)}]/100

Format output wajib berupa JSON object dengan properti persis seperti ini:
{
  "rationale": "penjelasan profesional bernada birokratis/akademis yang menjelaskan korelasi logis mengapa intervensi ini meningkatkan kualitas sekolah",
  "assumption": "asumsi model elastisitas kebijakan yang melandasi proyeksi kenaikan skor ini"
}`;

    const llmResult = await callLLM(prompt);
    if (llmResult) {
        try {
            const parsed = JSON.parse(llmResult);
            if (parsed.rationale && parsed.assumption) {
                return parsed;
            }
        } catch (e) {
            console.warn('[LLM] Failed to parse JSON response for simulation, using templates:', e);
        }
    }

    // High-fidelity fallback templates if no API key or parsing failed
    return getSimulationFallbackTemplate(schoolName, interventionType, magnitude);
}

/**
 * Analyzes parent complaints and drafts empathetic response letters.
 */
export async function analyzeComplaintLLM(
    text: string,
    schoolName: string
): Promise<ComplaintAIEnrichment> {
    const prompt = `Anda adalah asisten AI Dinas Pendidikan Jawa Timur.
Analisis laporan pengaduan wali murid sekolah "${schoolName}" berikut ini:
"${text}"

Tugas Anda:
1. Klasifikasikan ke salah satu Kategori: Bullying, Teacher Absenteeism, Facilities, Illegal Fees, Safety, Learning Quality, atau Other.
2. Tentukan Urgensi: Low, Medium, High, atau Critical (pilih Critical jika ada kekerasan fisik, pemalakan berat, atau fasilitas roboh membahayakan).
3. Tentukan Sentimen: Positive, Neutral, atau Negative.
4. Tulis penjelasan singkat (explanation) mengapa kategori dan urgensi tersebut dipilih.
5. Tulis draf tanggapan resmi (suggestedResponse) yang sangat empati, santun, dan solutif dalam Bahasa Indonesia dari pihak sekolah/dinas untuk orang tua murid. Hindari kalimat templat kosong; sesuaikan draf tanggapan dengan isi keluhan yang dilaporkan.

Format output wajib berupa JSON object dengan struktur persis seperti ini:
{
  "category": "Kategori terpilih",
  "urgency": "Urgensi terpilih",
  "sentiment": "Sentimen terpilih",
  "explanation": "Penjelasan mengapa memilih kategori & urgensi tersebut",
  "suggestedResponse": "Draf surat tanggapan resmi yang empati untuk orang tua murid"
}`;

    const llmResult = await callLLM(prompt);
    if (llmResult) {
        try {
            const parsed = JSON.parse(llmResult);
            if (parsed.category && parsed.urgency && parsed.suggestedResponse) {
                return parsed;
            }
        } catch (e) {
            console.warn('[LLM] Failed to parse JSON response for complaint analysis, using fallbacks:', e);
        }
    }

    // Fallback template matching
    return getComplaintFallbackTemplate(text, schoolName);
}

/**
 * Call Gemini or Groq API based on environment variables.
 */
async function callLLM(prompt: string): Promise<string | null> {
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (geminiKey) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            });

            if (res.ok) {
                const data: any = await res.json();
                return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
            } else {
                console.warn('[Gemini API] Error status:', res.status, await res.text());
            }
        } catch (err) {
            console.error('[Gemini API] Failed:', err);
        }
    }

    if (groqKey) {
        try {
            const url = 'https://api.groq.com/openai/v1/chat/completions';
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${groqKey}`
                },
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' }
                })
            });

            if (res.ok) {
                const data: any = await res.json();
                return data.choices?.[0]?.message?.content || null;
            } else {
                console.warn('[Groq API] Error status:', res.status, await res.text());
            }
        } catch (err) {
            console.error('[Groq API] Failed:', err);
        }
    }

    return null;
}

function getSimulationFallbackTemplate(
    schoolName: string,
    interventionType: string,
    magnitude: number
): SimulationRationale {
    if (interventionType === 'add_teachers') {
        return {
            rationale: `Penambahan ${magnitude} tenaga pendidik baru di ${schoolName} diproyeksikan mengurangi rasio beban kerja mengajar guru secara langsung. Hal ini memberikan lebih banyak ruang untuk bimbingan akademik individual dan perbaikan persiapan materi ajar di kelas.`,
            assumption: `Terdapat hubungan elastisitas positif antara penurunan rasio murid-guru terhadap kualitas pengawasan siswa dan efektivitas pembelajaran.`
        };
    } else if (interventionType === 'increase_bos') {
        return {
            rationale: `Peningkatan anggaran dana operasional BOS sebesar ${magnitude}% di ${schoolName} membebaskan kapasitas finansial sekolah untuk mendanai pemeliharaan alat peraga dan perbaikan fasilitas belajar secara berkala.`,
            assumption: `Fleksibilitas anggaran operasional sekolah mempercepat waktu respons perbaikan fasilitas belajar yang dikeluhkan wali murid.`
        };
    } else {
        return {
            rationale: `Investasi infrastruktur sebesar Rp ${magnitude.toLocaleString('id-ID')} di ${schoolName} akan difokuskan untuk rehabilitasi sarana penting seperti sanitasi toilet siswa, atap ruang kelas yang bocor, dan perbaikan fasilitas air bersih.`,
            assumption: `Fasilitas sekolah yang bersih, higienis, dan aman menurunkan tingkat kecemasan belajar siswa serta secara instan menaikkan indeks kepuasan orang tua.`
        };
    }
}

function getComplaintFallbackTemplate(
    text: string,
    schoolName: string
): ComplaintAIEnrichment {
    let category = 'Other';
    let urgency = 'Medium';
    let sentiment = 'Negative';

    const t = text.toLowerCase();
    if (t.includes('bully') || t.includes('rundung') || t.includes('pukul') || t.includes('palak')) {
        category = 'Bullying';
        urgency = 'Critical';
    } else if (t.includes('bolos') || t.includes('absen') || t.includes('tidak masuk') || t.includes('jarang mengajar')) {
        category = 'Teacher Absenteeism';
        urgency = 'High';
    } else if (t.includes('toilet') || t.includes('rusak') || t.includes('bangunan') || t.includes('bocor') || t.includes('hancur')) {
        category = 'Facilities';
        urgency = 'High';
    } else if (t.includes('pungli') || t.includes('biaya') || t.includes('bayar') || t.includes('uang')) {
        category = 'Illegal Fees';
        urgency = 'High';
    }

    let responseDraft = '';
    if (category === 'Bullying') {
        responseDraft = `Yth. Bapak/Ibu Wali Murid, kami sangat menyesalkan insiden ketidaknyamanan yang dialami putra/putri Anda. Sekolah ${schoolName} berkomitmen penuh untuk menjaga lingkungan belajar yang bebas dari perundungan. Guru BK dan wali kelas segera ditugaskan untuk menyelidiki aduan ini secara objektif dan mendampingi putra/putri Anda. Kami akan mengabari Bapak/Ibu segera setelah ada perkembangan baru.`;
    } else if (category === 'Teacher Absenteeism') {
        responseDraft = `Yth. Bapak/Ibu Wali Murid, kami berterima kasih atas masukan berharga Anda terkait kehadiran guru pengajar. Pihak manajemen sekolah ${schoolName} akan segera melakukan audit jadwal mengajar kelas terkait dan meminta klarifikasi resmi dari GTK yang bersangkutan. Kami berkomitmen memastikan hak belajar siswa terpenuhi secara penuh tanpa kekosongan kelas.`;
    } else if (category === 'Facilities') {
        responseDraft = `Yth. Bapak/Ibu Wali Murid, kami memohon maaf sebesar-besarnya atas ketidaknyamanan sarana belajar di ${schoolName}. Unit sarana prasarana kami telah menjadwalkan pemeriksaan fisik toilet/kelas tersebut untuk segera diperbaiki demi kenyamanan siswa belajar.`;
    } else if (category === 'Illegal Fees') {
        responseDraft = `Yth. Bapak/Ibu Wali Murid, terima kasih atas laporannya. Pimpinan sekolah bersama komite akan mengusut rincian pembiayaan yang dikeluhkan dan memastikan seluruh pungutan yang berjalan sudah melalui mufakat resmi serta sesuai regulasi pemerintah.`;
    } else {
        responseDraft = `Yth. Bapak/Ibu Wali Murid, laporan Anda mengenai ${schoolName} telah kami terima secara resmi. Staf manajemen sekolah sedang meninjau keluhan tersebut untuk menyusun tindak lanjut perbaikan yang tepat demi kenyamanan belajar siswa.`;
    }

    return {
        category,
        urgency,
        sentiment,
        explanation: `Klasifikasi '${category}' dengan urgensi '${urgency}' didasarkan pada kecocokan kata kunci laporan lokal yang terdeteksi.`,
        suggestedResponse: responseDraft
    };
}
