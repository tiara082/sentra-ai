import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../utils/api';
import { CheckCircle, ChevronRight } from 'lucide-react';
import logoSentraAI from '../assets/SENTRAI.png';

interface School {
    school_id: string;
    name: string;
    district: string;
}

export default function ParentPortal() {
    // Session state
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [phone, setPhone] = useState('');
    const [selectedSchool, setSelectedSchool] = useState('');
    const [schools, setSchools] = useState<School[]>([]);
    const [registrationError, setRegistrationError] = useState('');

    // Mode state: 'survey' | 'complaint'
    const [mode, setMode] = useState<'survey' | 'complaint'>('survey');

    // Survey state
    const [surveyStep, setSurveyStep] = useState(0);
    const [surveyScores, setSurveyScores] = useState<Record<string, number>>({
        teacher_attendance: 3,
        cleanliness: 3,
        bullying: 3,
        facilities: 3,
        learning_quality: 3,
        communication: 3,
        school_safety: 3,
        illegal_fees: 3,
        satisfaction: 3
    });
    const [surveyComment, setSurveyComment] = useState('');
    const [surveySuccess, setSurveySuccess] = useState(false);

    // Complaint state
    const [complaintText, setComplaintText] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [complaintRef, setComplaintRef] = useState('');
    const [submittingComplaint, setSubmittingComplaint] = useState(false);

    const surveyQuestions = [
        { key: 'teacher_attendance', label: 'Kehadiran Guru di Kelas', desc: 'Apakah guru-guru hadir tepat waktu dan mengajar di kelas?' },
        { key: 'cleanliness', label: 'Kebersihan Lingkungan Sekolah', desc: 'Bagaimana kondisi kebersihan kelas, halaman, dan toilet?' },
        { key: 'bullying', label: 'Keamanan dari Perundungan (Bullying)', desc: 'Apakah lingkungan sekolah aman dari ejekan, pemalakan, atau kekerasan?' },
        { key: 'facilities', label: 'Kondisi Fasilitas Belajar', desc: 'Bagaimana kelayakan meja, kursi, atap kelas, dan sarana perpustakaan?' },
        { key: 'learning_quality', label: 'Kualitas Pembelajaran', desc: 'Apakah penjelasan guru mudah dipahami oleh anak Anda?' },
        { key: 'communication', label: 'Komunikasi Sekolah dengan Orang Tua', desc: 'Seberapa terbuka sekolah dalam memberi informasi perkembangan anak?' },
        { key: 'school_safety', label: 'Keselamatan di Lingkungan Sekolah', desc: 'Bagaimana keamanan gerbang, instalasi listrik, dan penanganan bahaya?' },
        { key: 'illegal_fees', label: 'Bebas dari Pungutan Liar (Pungli)', desc: 'Apakah ada sumbangan paksa atau biaya buku/seragam di luar ketentuan?' },
        { key: 'satisfaction', label: 'Kepuasan Umum Terhadap Sekolah', desc: 'Secara umum, seberapa puas Anda dengan kualitas sekolah saat ini?' }
    ];

    useEffect(() => {
        // Load schools list
        fetch('http://localhost:8000/api/v1/schools')
            .then(res => res.json())
            .then(data => {
                if (data.schools) setSchools(data.schools);
            })
            .catch(err => console.error('Failed to load schools', err));
    }, []);

    // Registration Handler
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegistrationError('');
        if (!phone || !selectedSchool) {
            setRegistrationError('Nomor Telepon dan Sekolah wajib diisi.');
            return;
        }

        try {
            const data = await fetchAPI('/parents/register', {
                method: 'POST',
                body: JSON.stringify({
                    phone,
                    schoolId: selectedSchool,
                    consentStatus: true
                })
            });

            if (data.token) {
                localStorage.setItem('token', data.token);
                setToken(data.token);
            }
        } catch (err: any) {
            setRegistrationError(err.message || 'Pendaftaran gagal');
        }
    };

    // Survey Submit Handler
    const handleSurveySubmit = async () => {
        try {
            await fetchAPI('/parent-pulse/submit', {
                method: 'POST',
                body: JSON.stringify({
                    schoolId: selectedSchool,
                    period: '2026-07',
                    topicScores: surveyScores,
                    freeText: surveyComment || null
                })
            });
            setSurveySuccess(true);
        } catch (err: any) {
            alert(`Gagal mengirim survei: ${err.message}`);
        }
    };

    // Complaint Submit Handler
    const handleComplaintSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (complaintText.length < 20) {
            alert('Aduan harus minimal berisi 20 karakter.');
            return;
        }

        setSubmittingComplaint(true);
        try {
            const data = await fetchAPI('/complaints', {
                method: 'POST',
                body: JSON.stringify({
                    schoolId: selectedSchool,
                    text: complaintText,
                    isFullyAnonymous: isAnonymous
                })
            });
            setComplaintRef(data.complaintId);
            setComplaintText('');
        } catch (err: any) {
            alert(`Gagal mengirim aduan: ${err.message}`);
        } finally {
            setSubmittingComplaint(false);
        }
    };

    // Logout Helper
    const handleLogout = () => {
        localStorage.removeItem('token');
        setToken('');
    };

    // Unregistered state UI
    if (!token) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full border border-slate-100 rounded-2xl shadow-[0_8px_40px_-8px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.04)] p-8">
                    <div className="flex flex-col items-center mb-8">
                        <img src={logoSentraAI} alt="SENTRA-AI Logo" className="h-16 w-auto object-contain mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 font-display">Portal Orang Tua</h2>
                        <p className="text-sm text-gray-500 text-center mt-2">
                            Suara Anda membantu pembenahan kualitas pendidikan di Jawa Timur. Laporan Anda dijamin aman & rahasia.
                        </p>
                    </div>

                    {registrationError && (
                        <div className="bg-red-50/80 border border-red-200/80 text-red-700 text-sm p-4 rounded-xl mb-6 flex items-start gap-2">
                            <span className="mt-0.5 shrink-0">⚠️</span>
                            <span>{registrationError}</span>
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-6">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Nomor WhatsApp / Telepon
                            </label>
                            <input
                                type="tel"
                                placeholder="Contoh: 08123456789"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 px-4 py-3 rounded-xl transition-all duration-200 outline-none text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Sekolah Anak Anda
                            </label>
                            <select
                                value={selectedSchool}
                                onChange={e => setSelectedSchool(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 px-4 py-3 rounded-xl transition-all duration-200 outline-none text-sm"
                                required
                            >
                                <option value="">-- Pilih Sekolah --</option>
                                {schools.map(s => (
                                    <option key={s.school_id} value={s.school_id}>
                                        {s.name} ({s.district})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-start gap-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                            <input type="checkbox" id="consent" className="mt-1" defaultChecked required />
                            <label htmlFor="consent" className="text-xs text-gray-500 leading-relaxed">
                                Saya setuju untuk berpartisipasi dalam program penilaian kualitas sekolah secara berkala. Identitas saya dilindungi oleh UU PDP.
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-150 text-sm btn-glow-blue"
                        >
                            Masuk & Mulai
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Registered State PWA Container
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4">
            <div className="max-w-md w-full flex justify-between items-center py-4 mb-3">
                <div className="flex items-center gap-2.5">
                    <img src={logoSentraAI} alt="SENTRA-AI Logo" className="h-7 w-auto object-contain" />
                    <span className="text-sm font-semibold text-slate-800 tracking-tight">Sentra AI — Portal</span>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-medium px-3 py-1.5 rounded-lg transition-all duration-150"
                >
                    Keluar Sesi
                </button>
            </div>

            <div className="bg-white max-w-md w-full border border-slate-200/60 rounded-2xl shadow-[0_4px_24px_-4px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
                {/* Navigation Tab Header */}
                <div className="flex border-b border-slate-100 bg-slate-50/30">
                    <button
                        onClick={() => { setMode('survey'); setSurveySuccess(false); setSurveyStep(0); }}
                        className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-150 ${mode === 'survey' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'}`}
                    >
                        Survei Bulanan
                    </button>
                    <button
                        onClick={() => { setMode('complaint'); setComplaintRef(''); }}
                        className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-150 ${mode === 'complaint' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'}`}
                    >
                        Buat Aduan
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="p-8 flex-1">
                    {mode === 'survey' ? (
                        surveySuccess ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_4px_16px_rgba(16,185,129,0.15)]">
                                    <CheckCircle className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Survei Terkirim!</h3>
                                <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                                    Terima kasih atas partisipasi Anda. Umpan balik Anda telah kami enkripsi dan agregasikan untuk recalculation kesehatan sekolah secara langsung.
                                </p>
                            </div>
                        ) : (
                            <div>
                                {surveyStep < surveyQuestions.length ? (
                                    <div className="space-y-8">
                                        {/* Step Progress */}
                                        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 tracking-widest uppercase">
                                            <span>Aspek Evaluasi</span>
                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">{surveyStep + 1} / {surveyQuestions.length}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 rounded-full"
                                                style={{ width: `${((surveyStep + 1) / surveyQuestions.length) * 100}%` }}
                                            />
                                        </div>

                                        {/* Question Details */}
                                        <div className="space-y-2">
                                            <h4 className="text-lg font-bold text-slate-900 tracking-tight">{surveyQuestions[surveyStep].label}</h4>
                                            <p className="text-sm text-slate-500 leading-relaxed">{surveyQuestions[surveyStep].desc}</p>
                                        </div>

                                        {/* Rating Scale (1-5 Sliders) */}
                                        <div className="space-y-6 py-4">
                                            <input
                                                type="range"
                                                min="1"
                                                max="5"
                                                value={surveyScores[surveyQuestions[surveyStep].key]}
                                                onChange={e => setSurveyScores({
                                                    ...surveyScores,
                                                    [surveyQuestions[surveyStep].key]: parseInt(e.target.value)
                                                })}
                                                className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <div className="flex justify-between text-xs font-semibold text-slate-400 px-1">
                                                <span>1 — Sangat Buruk</span>
                                                <span className="text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full text-sm shadow-sm">
                                                    {surveyScores[surveyQuestions[surveyStep].key]} / 5
                                                </span>
                                                <span>5 — Sangat Baik</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setSurveyStep(prev => prev + 1)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-150 text-sm btn-glow-blue"
                                        >
                                            Selanjutnya <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <h4 className="text-lg font-bold text-gray-900">Ulasan Akhir</h4>
                                        <p className="text-sm text-gray-500 leading-relaxed">
                                            Tulis catatan tambahan berupa aduan khusus atau masukan umum mengenai sekolah secara bebas (opsional).
                                        </p>

                                        <textarea
                                            placeholder="Contoh: Toilet di dekat musala airnya mati semenjak seminggu yang lalu..."
                                            value={surveyComment}
                                            onChange={e => setSurveyComment(e.target.value)}
                                            rows={4}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-sm"
                                            maxLength={500}
                                        />

                                        <div className="flex items-center justify-between text-xs text-gray-400">
                                            <span>Maksimal 500 karakter</span>
                                            <span>{surveyComment.length}/500</span>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setSurveyStep(0)}
                                                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold py-3.5 rounded-xl transition-all duration-150 text-sm border border-slate-200 active:scale-[0.98]"
                                            >
                                                Ulangi
                                            </button>
                                            <button
                                                onClick={handleSurveySubmit}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-150 text-sm btn-glow-blue"
                                            >
                                                Kirim Survei
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        <div>
                            {complaintRef ? (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_4px_16px_rgba(16,185,129,0.15)]">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">Aduan Masuk Antrean</h3>
                                    <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                                        Laporan Anda telah berhasil dicatat. AI sedang menganalisis tingkat urgensi dan kategori secara asinkron di latar belakang.
                                    </p>
                                    <div className="bg-slate-50 p-4 border border-slate-200/70 rounded-xl my-6">
                                        <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">KODE LACAK ADUAN</span>
                                        <code className="text-sm font-bold text-gray-900 break-all select-all">{complaintRef}</code>
                                    </div>
                                    <button
                                        onClick={() => setComplaintRef('')}
                                        className="text-sm text-blue-600 hover:underline font-semibold"
                                    >
                                        Kirim Aduan Baru
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleComplaintSubmit} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            Deskripsi Detail Laporan
                                        </label>
                                        <textarea
                                            placeholder="Tulis kronologi atau laporan lengkap..."
                                            value={complaintText}
                                            onChange={e => setComplaintText(e.target.value)}
                                            rows={5}
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 px-4 py-3 rounded-xl transition-all duration-200 outline-none text-sm"
                                            required
                                            minLength={20}
                                            maxLength={2000}
                                        />
                                        <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
                                            <span>Minimal 20 karakter</span>
                                            <span>{complaintText.length}/2000</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-slate-50/80 border border-slate-200/70 rounded-xl">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700">Gunakan Anonimitas Penuh</label>
                                            <span className="text-[10px] text-gray-400">Pihak Dinas tidak dapat menghubungi Anda kembali.</span>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isAnonymous}
                                            onChange={e => setIsAnonymous(e.target.checked)}
                                            className="w-4 h-4 cursor-pointer accent-blue-600"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={submittingComplaint}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:shadow-none text-white font-semibold py-3.5 rounded-xl transition-all duration-150 text-sm btn-glow-blue flex items-center justify-center gap-2"
                                    >
                                        {submittingComplaint ? 'Sedang Memproses...' : 'Kirim Pengaduan'}
                                    </button>
                                </form>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
