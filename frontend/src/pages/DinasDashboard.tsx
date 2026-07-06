import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '../utils/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
    LayoutDashboard, Calculator, ShieldAlert, FileText, 
    RefreshCw, Download, ArrowRight, ShieldCheck, CheckCircle, AlertTriangle
} from 'lucide-react';

interface Recommendation {
    recommendation_id: string;
    school_id: string;
    school_name: string;
    district: string;
    cluster_id: number;
    rank: number;
    rationale: string;
    score_components: {
        priorityScore: number;
        compositeScore: number;
        recommendedIntervention: string;
    };
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
    health_score?: number;
    active_flags?: number;
    active_alerts?: number;
}

export default function DinasDashboard() {
    // Session state
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [userName, setUserName] = useState(localStorage.getItem('userName') || 'Analis Dinas');
    const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || '');
    const [userDistrictScope, setUserDistrictScope] = useState(localStorage.getItem('userDistrictScope') || '');

    // Navigation state
    const [activeTab, setActiveTab] = useState<'overview' | 'simulation' | 'recommendations' | 'complaints'>('overview');

    // General state
    const [schools, setSchools] = useState<School[]>([]);
    const [selectedSchoolId, setSelectedSchoolId] = useState('');

    // Principal specific state
    const [principalSchool, setPrincipalSchool] = useState<School | null>(null);
    const [principalHealth, setPrincipalHealth] = useState<any>(null);
    const [principalFlags, setPrincipalFlags] = useState<any[]>([]);
    const [updatingComplaintId, setUpdatingComplaintId] = useState('');
    const [newStatusValue, setNewStatusValue] = useState<Record<string, string>>({});

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

    // Leaflet map ref
    const mapRef = useRef<L.Map | null>(null);

    // Load data if authenticated
    useEffect(() => {
        if (token) {
            if (userRole === 'Principal') {
                loadPrincipalDashboardData();
            } else {
                loadDashboardData();
            }
        }
    }, [token, userRole]);

    // Setup Leaflet map when tab changes or schools load (only for Dinas/Supervisor)
    useEffect(() => {
        if (token && userRole !== 'Principal' && activeTab === 'overview' && schools.length > 0) {
            const timer = setTimeout(() => {
                const mapEl = document.getElementById('map-container');
                if (mapEl && !mapRef.current) {
                    const map = L.map('map-container', {
                        scrollWheelZoom: false
                    }).setView([-7.9666, 112.6326], 10);
                    
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap contributors'
                    }).addTo(map);
                    
                    mapRef.current = map;
                }

                if (mapRef.current) {
                    mapRef.current.eachLayer((layer) => {
                        if (layer instanceof L.CircleMarker) {
                            mapRef.current?.removeLayer(layer);
                        }
                    });

                    schools.forEach(s => {
                        if (s.geo_lat && s.geo_lng) {
                            const score = Number(s.health_score || 50);
                            let color = '#10b981'; 
                            if (score < 60) color = '#ef4444'; 
                            else if (score < 80) color = '#f59e0b'; 

                            const marker = L.circleMarker([s.geo_lat, s.geo_lng], {
                                radius: 8,
                                fillColor: color,
                                color: '#ffffff',
                                weight: 2,
                                opacity: 1,
                                fillOpacity: 0.85
                            }).addTo(mapRef.current!);

                            marker.bindPopup(`
                                <div style="font-family: sans-serif; font-size: 11px; padding: 4px;">
                                    <strong style="font-size: 12px; color: #1e293b;">${s.name}</strong><br/>
                                    <span style="color: #64748b;">NPSN: ${s.npsn}</span><br/>
                                    <hr style="margin: 6px 0; border: 0; border-top: 1px solid #e2e8f0;"/>
                                    <span>Skor Kesehatan: <strong>${score.toFixed(0)}/100</strong></span><br/>
                                    <span>Alert Peringatan: <strong style="color: ${color};">${s.active_alerts || 0} Aktif</strong></span>
                                </div>
                            `);
                        }
                    });
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [schools, activeTab, token, userRole]);

    // Load data for Principal dashboard
    const loadPrincipalDashboardData = async () => {
        try {
            // Find school name
            const allSchools = await fetchAPI('/schools');
            const mySchool = allSchools.schools?.find((s: School) => s.school_id === userDistrictScope);
            if (mySchool) {
                setPrincipalSchool(mySchool);
            }

            // Get health details
            const healthData = await fetchAPI(`/schools/${userDistrictScope}/health-score?period=2026-07`);
            setPrincipalHealth(healthData);

            // Get ground truth flags
            const flagsData = await fetchAPI(`/schools/${userDistrictScope}/ground-truth-flags?period=2026-07`);
            setPrincipalFlags(flagsData.flags || []);

            // Get complaints list for their school only
            const complaintsData = await fetchAPI(`/complaints?schoolId=${userDistrictScope}`);
            setComplaints(complaintsData.complaints || []);
            
            // Set initial status selection map
            const initialStatuses: Record<string, string> = {};
            complaintsData.complaints?.forEach((c: Complaint) => {
                initialStatuses[c.complaint_id] = c.status;
            });
            setNewStatusValue(initialStatuses);
        } catch (err) {
            console.error('Failed to load principal details:', err);
        }
    };

    // Load standard data for Dinas Analyst/Supervisor
    const loadDashboardData = async () => {
        try {
            const mapData = await fetchAPI('/risk-map');
            setSchools(mapData.schools || []);
            if (mapData.schools?.length > 0) {
                setSelectedSchoolId(mapData.schools[0].school_id);
            }

            loadRecommendations();
            loadAlerts();
            loadComplaints();
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        }
    };

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

    // Login Handler
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        try {
            const data = await fetchAPI('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('userRole', data.user.role);
                localStorage.setItem('userDistrictScope', data.user.districtScope);
                
                setToken(data.token);
                setUserName(data.user.name);
                setUserRole(data.user.role);
                setUserDistrictScope(data.user.districtScope);
            }
        } catch (err: any) {
            setLoginError(err.message || 'Login gagal. Periksa kembali email dan password.');
        }
    };

    // Logout Handler
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userDistrictScope');
        
        setToken('');
        setUserRole('');
        setUserDistrictScope('');
        setSchools([]);
        setRecs([]);
        setAlerts([]);
        setComplaints([]);
        setPrincipalSchool(null);
        setPrincipalHealth(null);
        setPrincipalFlags([]);
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }
    };

    // Principal: Update Complaint Status Handler
    const handleUpdateComplaintStatus = async (complaintId: string) => {
        const selectedStatus = newStatusValue[complaintId];
        if (!selectedStatus) return;

        setUpdatingComplaintId(complaintId);
        try {
            await fetchAPI(`/complaints/${complaintId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: selectedStatus })
            });
            alert('Status pengaduan berhasil diperbarui!');
            loadPrincipalDashboardData();
        } catch (err: any) {
            alert(`Gagal memperbarui status: ${err.message}`);
        } finally {
            setUpdatingComplaintId('');
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
            const mapData = await fetchAPI('/risk-map');
            setSchools(mapData.schools || []);
        } catch (err: any) {
            alert(`Gagal meresolusi alert: ${err.message}`);
        }
    };

    // Trigger AI Model Retraining
    const handleTriggerTraining = async () => {
        setTraining(true);
        setTrainingLogs('Menghubungi server pelatihan AI...');
        try {
            const data = await fetchAPI('/admin/train', { method: 'POST' });
            setTrainingLogs(JSON.stringify(data, null, 2));
            loadComplaints();
        } catch (err: any) {
            setTrainingLogs(`Error: ${err.message}`);
        } finally {
            setTraining(false);
        }
    };

    // Unauthenticated: Render Dinas Login Gate
    if (!token) {
        return (
            <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 font-display">Login Portal Pengelola</h2>
                        <p className="text-sm text-gray-500 text-center mt-2">
                            Masuk sesuai peran Anda (Analis Dinas, Pengawas, atau Kepala Sekolah).
                        </p>
                    </div>

                    {loginError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-4 rounded-xl">
                            {loginError}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Email Pengguna
                            </label>
                            <input
                                type="email"
                                placeholder="bu_rina@edupolicy.go.id"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-xs"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Kata Sandi
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white text-gray-900 px-4 py-3 rounded-xl transition duration-150 outline-none text-xs"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition duration-150 text-xs shadow-sm"
                        >
                            Masuk Portal
                        </button>
                    </form>

                    <div className="bg-blue-50 border border-blue-150 p-4 rounded-xl space-y-3">
                        <span className="block text-[10px] font-bold text-blue-600 uppercase tracking-wider">KREDENSI DEMO INTEGRASI:</span>
                        <div className="text-[10px] text-gray-600 leading-relaxed font-mono space-y-2">
                            <div>
                                <span className="text-gray-900 font-bold block">1. Analis Dinas (Akses Penuh Peta & Simulasi)</span>
                                Email: bu_rina@edupolicy.go.id<br/>Sandi: Password123
                            </div>
                            <div>
                                <span className="text-gray-900 font-bold block">2. Pengawas (Tindak Lanjut Alert Lapangan)</span>
                                Email: pak_herman@edupolicy.go.id<br/>Sandi: Password123
                            </div>
                            <div>
                                <span className="text-gray-900 font-bold block">3. Kepala Sekolah (Hanya SDN Lowokwaru 1 & Ubah Status)</span>
                                Email: bu_sari@edupolicy.go.id<br/>Sandi: Password123
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Principal specialized Dashboard (BR-06 & BR-07 Compliant)
    if (userRole === 'Principal') {
        const compScore = principalHealth?.current?.compositeScore || 50;
        const breakdown = principalHealth?.current?.dimensionBreakdown || {};

        return (
            <div className="min-h-screen bg-[#fafafa] flex flex-col text-gray-900 font-sans p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center pb-6 border-b border-gray-200">
                    <div>
                        <span className="text-[10px] font-extrabold text-blue-600 tracking-wider uppercase">PORTAL KEPALA SEKOLAH</span>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-1">
                            {principalSchool?.name || 'Sekolah Anda'}
                        </h2>
                        <span className="text-xs text-gray-400 font-medium">NPSN: {principalSchool?.npsn || '...'} | {principalSchool?.district || '...'}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm"
                    >
                        Keluar Sesi ({userName})
                    </button>
                </div>

                {/* Main Stats Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Radial Health Indicator */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center space-y-6">
                        <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">SKOR KESEHATAN SEKOLAH</span>
                        
                        <div className="relative w-40 h-40 flex items-center justify-center">
                            {/* Simple circular gauge */}
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="80" cy="80" r="70" stroke="#f3f4f6" strokeWidth="8" fill="transparent" />
                                <circle 
                                    cx="80" 
                                    cy="80" 
                                    r="70" 
                                    stroke="#3b82f6" 
                                    strokeWidth="8" 
                                    fill="transparent" 
                                    strokeDasharray={`${2 * Math.PI * 70}`}
                                    strokeDashoffset={`${2 * Math.PI * 70 * (1 - compScore / 100)}`}
                                />
                            </svg>
                            <div className="absolute text-center">
                                <span className="text-4xl font-black text-gray-900">{compScore.toFixed(0)}</span>
                                <span className="block text-[10px] font-bold text-gray-400">KOMPOSIT</span>
                            </div>
                        </div>

                        <span className="text-[10px] font-bold text-gray-400 text-center leading-relaxed">
                            Diperbarui dinamis berdasarkan 9 aspek survey berkala orang tua dan indikator resmi Dapodik.
                        </span>
                    </div>

                    {/* Dimension Breakdown */}
                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <h3 className="text-sm font-bold text-gray-800 tracking-tight">Rincian Skor Per Dimensi</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { key: 'academic', label: 'Dimensi Akademik', score: breakdown.academic || 50 },
                                { key: 'teacher', label: 'Dimensi Guru & Tenaga GTK', score: breakdown.teacher || 50 },
                                { key: 'infrastructure', label: 'Dimensi Sarpras & Toilet', score: breakdown.infrastructure || 50 },
                                { key: 'finance', label: 'Dimensi Transparansi Keuangan', score: breakdown.finance || 50 },
                                { key: 'studentWelfare', label: 'Keamanan (Safety & Bullying)', score: breakdown.studentWelfare || 50 },
                                { key: 'parentSatisfaction', label: 'Kepuasan Ulasan Orang Tua', score: breakdown.parentSatisfaction || 50 }
                            ].map(d => (
                                <div key={d.key} className="bg-gray-50 p-4 rounded-xl border border-gray-150 space-y-2">
                                    <div className="flex justify-between items-center text-xs font-bold">
                                        <span className="text-gray-700">{d.label}</span>
                                        <span className="text-blue-600">{Number(d.score).toFixed(0)}</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-600" style={{ width: `${d.score}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ground Truth Warning Flags */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-gray-800 tracking-tight">Inkonsistensi Data (Ground Truth Flags)</h3>
                    
                    {principalFlags.length > 0 ? (
                        <div className="space-y-3">
                            {principalFlags.map(f => (
                                <div key={f.flag_id} className="bg-red-50 border border-red-150 p-4 rounded-xl flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                                    <div>
                                        <span className="block text-xs font-bold text-red-800 uppercase tracking-wide">FLAGS: DISKREPANSI {f.indicator.toUpperCase()}</span>
                                        <p className="text-xs text-red-700 mt-1 leading-relaxed">
                                            Dapodik mencatat nilai tinggi ({f.official_value}%), namun survei rating orang tua hanya mendeteksi ({f.parent_value}%). Gaps deviasi sebesar {f.gap_score.toFixed(1)} standard deviations.
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-emerald-50 border border-emerald-150 p-4 rounded-xl flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                            <span className="text-xs font-bold text-emerald-800">
                                Tidak ada inkonsistensi signifikan terdeteksi. Data Dapodik sejalan dengan persepsi nyata orang tua.
                            </span>
                        </div>
                    )}
                </div>

                {/* Complaints Section & Response (BR-07 compliant: no parent identity exposed) */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <h3 className="text-sm font-bold text-gray-800 tracking-tight">
                        Pengaduan Masuk Sekolah & Tindak Lanjut
                    </h3>

                    {complaints.length > 0 ? (
                        <div className="space-y-6">
                            {complaints.map(c => (
                                <div key={c.complaint_id} className="bg-gray-50 border border-gray-150 p-6 rounded-2xl flex flex-col md:flex-row justify-between gap-6">
                                    <div className="space-y-2 flex-1">
                                        <div className="flex gap-3 items-center">
                                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-extrabold text-[9px] uppercase">{c.category}</span>
                                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${c.urgency === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                                                URGENSI: {c.urgency.toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-800 font-medium leading-relaxed">{c.text}</p>
                                        <span className="block text-[9px] text-gray-400 pt-2">Masuk: {new Date(c.created_at).toLocaleString('id-ID')}</span>
                                    </div>

                                    {/* Action Form */}
                                    <div className="w-full md:w-56 shrink-0 flex flex-col justify-center space-y-3">
                                        <div>
                                            <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Status Pengaduan</label>
                                            <select
                                                value={newStatusValue[c.complaint_id] || c.status}
                                                onChange={e => setNewStatusValue({
                                                    ...newStatusValue,
                                                    [c.complaint_id]: e.target.value
                                                })}
                                                disabled={c.status === 'Resolved'}
                                                className="w-full bg-white border border-gray-200 focus:border-blue-500 text-gray-900 px-3 py-2 rounded-lg outline-none text-xs"
                                            >
                                                <option value="Received">Received</option>
                                                <option value="Acknowledged">Acknowledged</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Resolved">Resolved</option>
                                            </select>
                                        </div>
                                        {c.status !== 'Resolved' && (
                                            <button
                                                onClick={() => handleUpdateComplaintStatus(c.complaint_id)}
                                                disabled={updatingComplaintId === c.complaint_id}
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-2 rounded-lg transition duration-150 text-[10px] shadow-sm"
                                            >
                                                {updatingComplaintId === c.complaint_id ? 'Menyimpan...' : 'Perbarui Status'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-xs text-gray-400">
                            Belum ada pengaduan terdaftar untuk sekolah Anda pada bulan ini.
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Authenticated Dinas Analyst / Supervisor Dashboard View
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
                    {userRole !== 'Supervisor' && (
                        <button
                            onClick={() => setActiveTab('simulation')}
                            className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition duration-150 ${activeTab === 'simulation' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                            <Calculator className="w-4 h-4" />
                            SIMULASI KEBIJAKAN
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('recommendations')}
                        className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition duration-150 ${activeTab === 'recommendations' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                        <ShieldAlert className="w-4 h-4" />
                        REKOMENDASI & ALERTS
                    </button>
                    {userRole !== 'Supervisor' && (
                        <button
                            onClick={() => setActiveTab('complaints')}
                            className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition duration-150 ${activeTab === 'complaints' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                            <FileText className="w-4 h-4" />
                            PENGADUAN MASUK (AI)
                        </button>
                    )}
                </nav>

                <div className="pt-6 border-t border-gray-150 flex justify-between items-center">
                    <div>
                        <span className="text-[10px] text-gray-400 block font-semibold tracking-wider uppercase mb-1">ANALIS LOGIN</span>
                        <span className="text-xs font-bold text-gray-800">{userName}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-[10px] font-semibold text-red-500 hover:text-red-700"
                    >
                        Log Out
                    </button>
                </div>
            </aside>

            {/* Main Section */}
            <main className="flex-1 p-8 md:p-12 overflow-y-auto max-w-7xl mx-auto w-full">
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight font-display">Ringkasan & Peta Risiko</h2>
                            <p className="text-sm text-gray-500 mt-2">Daftar kesehatan sekolah, deteksi gap data, dan sebaran geografis sekolah di Jawa Timur.</p>
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

                        {/* Map & List */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-4">
                                <h3 className="text-sm font-bold text-gray-800 tracking-tight">Sebaran Geografis Titik Sekolah</h3>
                                <div id="map-container" className="h-96 rounded-xl border border-gray-150 z-10"></div>
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
                                                <div className="text-4xl font-black text-gray-400 mt-2">{simResult.originalComposite.toFixed(2)}</div>
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
                                    {recs.map(r => {
                                        const compScore = r.score_components?.compositeScore !== undefined 
                                            ? Number(r.score_components.compositeScore) 
                                            : 0;
                                        const intervention = r.score_components?.recommendedIntervention || 'N/A';
                                        
                                        return (
                                            <tr key={r.recommendation_id} className="hover:bg-gray-50/50">
                                                <td className="p-4 text-center font-bold text-blue-600">{r.rank}</td>
                                                <td className="p-4 font-bold text-gray-900">{r.school_name}</td>
                                                <td className="p-4 text-gray-500">{r.district}</td>
                                                <td className="p-4 text-center font-medium">{compScore.toFixed(0)}/100</td>
                                                <td className="p-4 font-semibold text-gray-800">{intervention}</td>
                                                <td className="p-4 text-gray-500 max-w-xs leading-relaxed">{r.rationale}</td>
                                            </tr>
                                        );
                                    })}
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
