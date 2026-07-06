import React, { useState, useEffect } from 'react';
import { fetchAPI } from '../utils/api';
import { 
    LayoutDashboard, MapPin, Calculator, ShieldAlert, FileText, 
    RefreshCw, Download, ArrowRight
} from 'lucide-react';

interface Recommendation {
    schoolId: string;
    schoolName: string;
    district: string;
    clusterId: number;
    compositeScore: number;
    rank: number;
    recommendedIntervention: string;
    rationale: string;
    priorityScore: number;
}

interface AlertItem {
    alert_id: string;
    school_id: string;
    school_name?: string;
    trigger_type: string;
    severity: string;
    opened_at: string;
    status: string;
}

interface Complaint {
    complaint_id: string;
    school_name: string;
    text: string;
    category: string;
    urgency: string;
    sentiment: string;
    status: string;
    created_at: string;
}

interface School {
    school_id: string;
    name: string;
    npsn: string;
    district: string;
    geo_lat: number;
    geo_lng: number;
}

export default function DinasDashboard() {
    // Navigation state: 'overview' | 'simulation' | 'recommendations' | 'complaints'
    const [activeTab, setActiveTab] = useState<'overview' | 'simulation' | 'recommendations' | 'complaints'>('overview');

    // General state
    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    // Simulation state
    const [simType, setSimType] = useState('add_teachers');
    const [simMag, setSimMag] = useState(2);
    const [simResult, setSimResult] = useState<any>(null);
    const [simulating, setSimulating] = useState(false);

    // Recommendations & Alerts state
    const [recs, setRecs] = useState<Recommendation[]>([]);
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [resolvingAlertId, setResolvingAlertId] = useState('');
    const [visitNote, setVisitNote] = useState('');

    // Complaints state
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [trainingLogs, setTrainingLogs] = useState('');
    const [training, setTraining] = useState(false);

    useEffect(() => {
        // Load initial data
        fetchAPI('/schools').then(data => {
            setSchools(data.schools || []);
            if (data.schools?.length > 0) {
                setSelectedSchoolId(data.schools[0].school_id);
            }
        }).catch(err => console.error(err));

        loadRecommendations();
        loadAlerts();
        loadComplaints();
    }, []);

    const loadRecommendations = async () => {
        try {
            const data = await fetchAPI('/recommendations?period=2026-07');
            setRecs(data.recommendations || []);
        } catch (err) {
            console.error(err);
        }
    };

    const loadAlerts = async () => {
        try {
            const data = await fetchAPI('/alerts');
            setAlerts(data.alerts || []);
        } catch (err) {
            console.error(err);
        }
    };

    const loadComplaints = async () => {
        try {
            const data = await fetchAPI('/complaints');
            setComplaints(data.complaints || []);
        } catch (err) {
            console.error(err);
        }
    };

    // Run Policy Simulation
    const handleRunSimulation = async (e: React.FormEvent) => {
        e.preventDefault();
        setSimulating(true);
        try {
            const data = await fetchAPI('/simulations', {
                method: 'POST',
                body: JSON.stringify({
                    schoolId: selectedSchoolId,
                    interventionType: simType,
                    magnitude: simMag,
                    period: '2026-07'
                })
            });
            setSimResult(data);
        } catch (err: any) {
            alert(`Simulasi gagal: ${err.message}`);
        } finally {
            setSimulating(false);
        }
    };

    // Resolve Alert Outcome
    const handleResolveAlert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!visitNote) return;

        try {
            await fetchAPI(`/alerts/${resolvingAlertId}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    resolutionNote: visitNote,
                    status: 'Closed'
                })
            });
            setResolvingAlertId('');
            setVisitNote('');
            loadAlerts();
        } catch (err: any) {
            alert(`Gagal meresolusi alert: ${err.message}`);
        }
    };

    // Trigger AI Model Retraining
    const handleTriggerTraining = async () => {
        setTraining(true);
        setTrainingLogs('Menghubungi server pelatihan AI...');
        try {
            const data = await fetchAPI('/data-integration/train', { method: 'POST' });
            setTrainingLogs(JSON.stringify(data, null, 2));
            loadComplaints();
        } catch (err: any) {
            setTrainingLogs(`Error: ${err.message}`);
        } finally {
            setTraining(false);
        }
    };

    // Render tabs
    return (
        <div className="min-h-screen bg-[#fafafa] flex flex-col md:flex-row text-gray-900 font-sans">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col p-6 space-y-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                        <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold tracking-tight">EduPolicy Lab AI</h1>
                        <span className="text-[10px] text-gray-400 font-medium">KABUPATEN MALANG</span>
                    </div>
                </div>

                <nav className="flex-1 flex flex-col space-y-1">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition duration-150 ${activeTab === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        RINGKASAN & PETA RISIKO
                    </button>
                    <button
                        onClick={() => setActiveTab('simulation')}
                        className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition duration-150 ${activeTab === 'simulation' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        <Calculator className="w-4 h-4" />
                        SIMULASI KEBIJAKAN
                    </button>
                    <button
                        onClick={() => setActiveTab('recommendations')}
                        className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition duration-150 ${activeTab === 'recommendations' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        <ShieldAlert className="w-4 h-4" />
                        REKOMENDASI & ALERTS
                    </button>
                    <button
                        onClick={() => setActiveTab('complaints')}
                        className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition duration-150 ${activeTab === 'complaints' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        <FileText className="w-4 h-4" />
                        PENGADUAN MASUK (AI)
                    </button>
                </nav>

                <div className="pt-6 border-t border-gray-150">
                    <span className="text-[10px] text-gray-400 block font-semibold tracking-wider uppercase mb-1">ANALIS DINAS</span>
                    <span className="text-xs font-bold text-gray-800">Bu Rina</span>
                </div>
            </aside>

            {/* Main Section */}
            <main className="flex-1 p-8 md:p-12 overflow-y-auto max-w-7xl mx-auto w-full">
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        {/* Title Header */}
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight font-display">Ringkasan & Peta Risiko</h2>
                            <p className="text-sm text-gray-500 mt-2">Daftar kesehatan sekolah, deteksi gap official vs survey, dan sebaran geografis.</p>
                        </div>

                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">RATA KESEHATAN SEKOLAH</span>
                                <div className="text-3xl font-extrabold text-gray-900 mt-2">72.6 <span className="text-xs text-gray-400">/100</span></div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">PERINGATAN DINI (ACTIVE)</span>
                                <div className="text-3xl font-extrabold text-amber-500 mt-2">{alerts.filter(a => a.status === 'Open').length} Kasus</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">ANOMALI DATA (GROUND TRUTH)</span>
                                <div className="text-3xl font-extrabold text-red-500 mt-2">4 Sekolah</div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">RESPONS ORANG TUA</span>
                                <div className="text-3xl font-extrabold text-blue-600 mt-2">84.2%</div>
                            </div>
                        </div>

                        {/* Simulated Map & List */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
                                <h3 className="text-sm font-bold text-gray-800 tracking-tight">Sebaran Geografis Titik Sekolah</h3>
                                <div className="bg-gray-50 h-96 rounded-xl border border-gray-150 flex items-center justify-center text-center p-8 relative">
                                    <div className="space-y-2">
                                        <MapPin className="w-12 h-12 text-blue-500 mx-auto animate-pulse" />
                                        <p className="text-sm font-bold text-gray-800">Visualisasi Peta Interaktif Jawa Timur</p>
                                        <p className="text-xs text-gray-400 max-w-sm mx-auto">
                                            SDN Lowokwaru 1 (NPSN: 20534013), SDN Lowokwaru 2 (NPSN: 20534014) terplot secara spasial untuk klasterisasi peer cluster.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
                                <h3 className="text-sm font-bold text-gray-800 tracking-tight">Daftar NPSN Sekolah</h3>
                                <div className="space-y-3 max-h-[380px] overflow-y-auto">
                                    {schools.map(s => (
                                        <button
                                            key={s.school_id}
                                            onClick={() => setSelectedSchoolId(s.school_id)}
                                            className={`w-full text-left p-4 rounded-xl border transition duration-150 text-xs ${selectedSchoolId === s.school_id ? 'border-blue-500 bg-blue-50' : 'border-gray-150 hover:bg-gray-50'}`}
                                        >
                                            <span className="block font-bold text-gray-900">{s.name}</span>
                                            <span className="text-[10px] text-gray-400 mt-1 block">NPSN: {s.npsn} | {s.district}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'simulation' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight font-display">Simulasi Dampak Kebijakan</h2>
                            <p className="text-sm text-gray-500 mt-2">Uji dampak elastisitas peningkatan anggaran atau penambahan guru secara real-time.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                                <h3 className="text-sm font-bold text-gray-800 tracking-tight mb-6">Konfigurasi Intervensi</h3>
                                <form onSubmit={handleRunSimulation} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-2">PILIH SEKOLAH</label>
                                        <select
                                            value={selectedSchoolId}
                                            onChange={e => setSelectedSchoolId(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-xs"
                                        >
                                            {schools.map(s => (
                                                <option key={s.school_id} value={s.school_id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-2">JENIS INTERVENSI</label>
                                        <select
                                            value={simType}
                                            onChange={e => setSimType(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-xs"
                                        >
                                            <option value="add_teachers">Penambahan Tenaga Pengajar (Guru)</option>
                                            <option value="increase_bos">Peningkatan Anggaran Operasional (BOS %)</option>
                                            <option value="infrastructure_investment">Renovasi Infrastruktur & Sarpras (Rupiah)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-2">BESARAN MAGNITUDE</label>
                                        <input
                                            type="number"
                                            value={simMag}
                                            onChange={e => setSimMag(parseFloat(e.target.value))}
                                            className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-xs"
                                            required
                                        />
                                        <span className="text-[9px] text-gray-400 mt-2 block">Masukkan jumlah guru, persentase BOS (%), atau nominal rupiah sarpras.</span>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={simulating}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition duration-150 text-xs shadow-sm flex items-center justify-center gap-2"
                                    >
                                        {simulating ? 'Sedang Memproyeksikan...' : 'Proyeksikan Dampak'}
                                    </button>
                                </form>
                            </div>

                            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
                                <h3 className="text-sm font-bold text-gray-800 tracking-tight">Hasil Proyeksi Real-time</h3>
                                
                                {simResult ? (
                                    <div className="space-y-6">
                                        <div className="flex flex-col sm:flex-row gap-6 items-center">
                                            <div className="bg-gray-50 border border-gray-150 p-6 rounded-2xl text-center flex-1 w-full">
                                                <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">SKOR AWAL</span>
                                                <div className="text-4xl font-black text-gray-400 mt-2">{simResult.originalCompositeScore.toFixed(2)}</div>
                                            </div>
                                            <ArrowRight className="w-6 h-6 text-gray-300 hidden sm:block" />
                                            <div className="bg-blue-50 border border-blue-150 p-6 rounded-2xl text-center flex-1 w-full">
                                                <span className="text-[10px] font-bold text-blue-500 tracking-wider uppercase">PROYEKSI RANGE BARU</span>
                                                <div className="text-4xl font-black text-blue-600 mt-2">
                                                    [{simResult.projectedCompositeMin.toFixed(2)} - {simResult.projectedCompositeMax.toFixed(2)}]
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-150 space-y-4">
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase">DASAR KOEFISIEN MARGINAL</span>
                                                <p className="text-xs text-gray-700 mt-2 font-medium leading-relaxed">{simResult.coefficientBasis}</p>
                                            </div>
                                            <hr className="border-gray-200" />
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase">ASUMSI MODEL DAMPAK</span>
                                                <p className="text-xs text-gray-600 mt-2 leading-relaxed">{simResult.assumption}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-64 flex items-center justify-center text-center text-xs text-gray-400">
                                        Pilih konfigurasi intervensi kebijakan di sebelah kiri lalu tekan Proyeksikan Dampak.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'recommendations' && (
                    <div className="space-y-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight font-display">Priority Recommendations & Alerts</h2>
                                <p className="text-sm text-gray-500 mt-2">Rangking alokasi intervensi dinas hasil perhitungan Multi-Criteria Decision Analysis.</p>
                            </div>
                            <a
                                href="http://localhost:8000/api/v1/recommendations/export?period=2026-07"
                                download
                                className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold px-4 py-2.5 rounded-xl transition duration-150 text-xs shadow-sm flex items-center gap-2 max-w-fit"
                            >
                                <Download className="w-4 h-4" /> Unduh CSV Rekomendasi
                            </a>
                        </div>

                        {/* Recommendations Table */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold">
                                        <th className="p-4 w-12 text-center">RANK</th>
                                        <th className="p-4">NAMA SEKOLAH</th>
                                        <th className="p-4">DISTRIK / KECAMATAN</th>
                                        <th className="p-4 w-28 text-center">HEALTH SCORE</th>
                                        <th className="p-4">REKOMENDASI INTERVENSI</th>
                                        <th className="p-4">ALASAN / RATIONALE</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-150">
                                    {recs.map(r => (
                                        <tr key={r.schoolId} className="hover:bg-gray-50/50">
                                            <td className="p-4 text-center font-bold text-blue-600">{r.rank}</td>
                                            <td className="p-4 font-bold text-gray-900">{r.schoolName}</td>
                                            <td className="p-4 text-gray-500">{r.district}</td>
                                            <td className="p-4 text-center font-medium">{r.compositeScore.toFixed(0)}/100</td>
                                            <td className="p-4 font-semibold text-gray-800">{r.recommendedIntervention}</td>
                                            <td className="p-4 text-gray-500 max-w-xs leading-relaxed">{r.rationale}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Alerts Management Section */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-gray-900">Peringatan Dini & Kunjungan Lapangan</h3>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="p-4 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                                        Daftar Alert Aktif
                                    </div>
                                    <div className="divide-y divide-gray-150 max-h-[300px] overflow-y-auto">
                                        {alerts.map(a => (
                                            <div key={a.alert_id} className="p-4 flex justify-between items-center text-xs">
                                                <div className="space-y-1">
                                                    <span className="font-bold text-gray-900">{a.school_name || 'SDN Lowokwaru 1'}</span>
                                                    <div className="flex gap-2 items-center text-[10px] text-gray-400">
                                                        <span>Urgensi: <strong className="text-red-500 uppercase">{a.severity}</strong></span>
                                                        <span>•</span>
                                                        <span>Dipicu: {new Date(a.opened_at).toLocaleString('id-ID')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 items-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'Closed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        {a.status === 'Closed' ? 'Selesai' : 'Aktif'}
                                                    </span>
                                                    {a.status === 'Open' && (
                                                        <button
                                                            onClick={() => setResolvingAlertId(a.alert_id)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition duration-150 text-[10px] font-bold"
                                                        >
                                                            Tindak Lanjut
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Resolusi Peringatan Dini</h4>
                                    {resolvingAlertId ? (
                                        <form onSubmit={handleResolveAlert} className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 mb-2">CATATAN KUNJUNGAN PENGAWAS</label>
                                                <textarea
                                                    placeholder="Tuliskan hasil penyidikan atau pembinaan di lapangan..."
                                                    value={visitNote}
                                                    onChange={e => setVisitNote(e.target.value)}
                                                    rows={4}
                                                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 p-3 rounded-xl transition duration-150 outline-none text-xs"
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition duration-150 text-xs"
                                            >
                                                Simpan & Tutup Alert
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="h-48 flex items-center justify-center text-center text-xs text-gray-400">
                                            Pilih tombol "Tindak Lanjut" pada alert aktif untuk mencatat resolusi kunjungan.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'complaints' && (
                    <div className="space-y-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight font-display">Pengaduan Masuk (Inbound Review)</h2>
                                <p className="text-sm text-gray-500 mt-2">Daftar laporan orang tua yang didekripsi secara aman dengan analisis sentimen, kategori, dan kemiripan AI.</p>
                            </div>
                            <button
                                onClick={handleTriggerTraining}
                                disabled={training}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-4 py-2.5 rounded-xl transition duration-150 text-xs shadow-sm flex items-center gap-2 max-w-fit"
                            >
                                <RefreshCw className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} /> Latih Ulang AI Klasifikasi
                            </button>
                        </div>

                        {trainingLogs && (
                            <div className="bg-gray-50 border border-gray-150 p-6 rounded-2xl">
                                <span className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-2">LOG RETRAINING & HOT-RELOAD</span>
                                <pre className="text-[10px] font-mono text-gray-700 overflow-x-auto whitespace-pre-wrap">{trainingLogs}</pre>
                            </div>
                        )}

                        {/* Complaints Card List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {complaints.map(c => (
                                <div key={c.complaint_id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-extrabold text-blue-600 tracking-wide uppercase">{c.category}</span>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${c.urgency === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                                                URGENSI: {c.urgency.toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-800 leading-relaxed font-medium">{c.text}</p>
                                    </div>

                                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-semibold">
                                        <span>Sentimen: <strong className="text-gray-600">{c.sentiment}</strong></span>
                                        <span>Status: {c.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
