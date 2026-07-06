import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../utils/api';
import { CheckCircle, ShieldCheck, ChevronRight } from 'lucide-react';

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
            <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full border border-gray-200 rounded-2xl shadow-sm p-8">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 font-display">Portal Orang Tua</h2>
                        <p className="text-sm text-gray-500 text-center mt-2">
                            Suara Anda membantu pembenahan kualitas pendidikan di Jawa Timur. Laporan Anda dijamin aman & rahasia.
                        </p>
                    </div>

                    {registrationError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl mb-6">
                            {registrationError}
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
                                className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-sm"
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
                                className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-sm"
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

                        <div className="flex items-start gap-3 bg-gray-50 p-4 rounded-xl border border-gray-150">
                            <input type="checkbox" id="consent" className="mt-1" defaultChecked required />
                            <label htmlFor="consent" className="text-xs text-gray-500 leading-relaxed">
                                Saya setuju untuk berpartisipasi dalam program penilaian kualitas sekolah secara berkala. Identitas saya dilindungi oleh UU PDP.
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition duration-150 text-sm shadow-sm"
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
        <div className="min-h-screen bg-[#fafafa] flex flex-col items-center p-4">
            <div className="max-w-md w-full flex justify-between items-center py-4 mb-2">
                <span className="text-sm font-semibold text-gray-800">Sentra AI — PWA Portal</span>
                <button
                    onClick={handleLogout}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                >
                    Keluar Sesi
                </button>
            </div>

            <div className="bg-white max-w-md w-full border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                {/* Navigation Tab Header */}
                <div className="flex border-b border-gray-150">
                    <button
                        onClick={() => { setMode('survey'); setSurveySuccess(false); setSurveyStep(0); }}
                        className={`flex-1 py-4 text-sm font-medium transition duration-150 ${mode === 'survey' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Survei Bulanan
                    </button>
                    <button
                        onClick={() => { setMode('complaint'); setComplaintRef(''); }}
                        className={`flex-1 py-4 text-sm font-medium transition duration-150 ${mode === 'complaint' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Buat Aduan
                    </button>
                </div>

                {/* Main Content Area */}
                <div className="p-8 flex-1">
                    {mode === 'survey' ? (
                        surveySuccess ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Survei Terkirim!</h3>
                                <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                                    Terima kasih atas partisipasi Anda. Umpan balik Anda telah kami enkripsi dan agregasikan untuk recalculation kesehatan sekolah secara langsung.
                                </p>
                            </div>
                        ) : (
                            <div>
                                {surveyStep < surveyQuestions.length ? (
                                    <div className="space-y-8">
                                        {/* Step Progress */}
                                        <div className="flex justify-between items-center text-xs font-semibold text-gray-400">
                                            <span>ASPEK EVALUASI</span>
                                            <span>{surveyStep + 1} dari {surveyQuestions.length}</span>
                                        </div>
                                        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 transition-all duration-300"
                                                style={{ width: `${((surveyStep + 1) / surveyQuestions.length) * 100}%` }}
                                            />
                                        </div>

                                        {/* Question Details */}
                                        <div className="space-y-2">
                                            <h4 className="text-lg font-bold text-gray-900">{surveyQuestions[surveyStep].label}</h4>
                                            <p className="text-sm text-gray-500 leading-relaxed">{surveyQuestions[surveyStep].desc}</p>
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
                                            <div className="flex justify-between text-xs font-bold text-gray-400 px-1">
                                                <span>1 (Sangat Buruk)</span>
                                                <span className="text-blue-600 text-sm bg-blue-50 px-2 py-0.5 rounded-md">
                                                    Nilai: {surveyScores[surveyQuestions[surveyStep].key]}
                                                </span>
                                                <span>5 (Sangat Baik)</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setSurveyStep(prev => prev + 1)}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition duration-150 text-sm shadow-sm"
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

                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setSurveyStep(0)}
                                                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl transition duration-150 text-sm border border-gray-250"
                                            >
                                                Ulangi
                                            </button>
                                            <button
                                                onClick={handleSurveySubmit}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition duration-150 text-sm shadow-sm"
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
                                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">Aduan Masuk Antrean</h3>
                                    <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                                        Laporan Anda telah berhasil dicatat. AI sedang menganalisis tingkat urgensi dan kategori secara asinkron di latar belakang.
                                    </p>
                                    <div className="bg-gray-50 p-4 border border-gray-150 rounded-xl my-6">
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
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-sm"
                                            required
                                            minLength={20}
                                            maxLength={2000}
                                        />
                                        <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
                                            <span>Minimal 20 karakter</span>
                                            <span>{complaintText.length}/2000</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-150 rounded-xl">
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
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition duration-150 text-sm shadow-sm flex items-center justify-center gap-2"
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
