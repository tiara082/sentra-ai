import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '../utils/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import logoSentraAI from '../assets/SENTRAI.png';
import { 
    LayoutDashboard, Calculator, ShieldAlert, FileText, 
    RefreshCw, Download, ArrowRight, CheckCircle, AlertTriangle
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
    explanation?: string;
    suggested_response?: string;
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
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center p-4">
                <div className="bg-white max-w-md w-full border border-slate-100 rounded-2xl shadow-[0_8px_40px_-8px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.04)] p-8 space-y-6">
                    <div className="flex flex-col items-center">
                        <img src={logoSentraAI} alt="SENTRA-AI Logo" className="h-16 w-auto object-contain mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Login Portal Pengelola</h2>
                        <p className="text-sm text-slate-500 text-center mt-2">
                            Masuk sesuai peran Anda (Analis Dinas, Pengawas, atau Kepala Sekolah).
                        </p>
                    </div>

                    {loginError && (
                        <div className="bg-red-50/80 border border-red-200/80 text-red-700 text-xs p-4 rounded-xl flex items-start gap-2">
                            <span className="mt-0.5 shrink-0">⚠️</span>
                            <span>{loginError}</span>
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
                                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 px-4 py-3 rounded-xl transition-all duration-200 outline-none text-xs"
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
                                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 px-4 py-3 rounded-xl transition-all duration-200 outline-none text-xs"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-150 text-xs btn-glow-blue"
                        >
                            Masuk Portal
                        </button>
                    </form>

                    <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-xl space-y-3">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">🔑 Kredensial Demo Integrasi</span>
                        <div className="text-[10px] text-slate-600 leading-relaxed font-mono space-y-3">
                            <div className="p-3 bg-white rounded-lg border border-slate-200/60">
                                <span className="text-slate-900 font-bold font-sans block mb-1">1. Analis Dinas (Akses Penuh)</span>
                                <span className="text-slate-500">bu_rina@edupolicy.go.id &middot; Password123</span>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-slate-200/60">
                                <span className="text-slate-900 font-bold font-sans block mb-1">2. Pengawas (Alert Lapangan)</span>
                                <span className="text-slate-500">pak_herman@edupolicy.go.id &middot; Password123</span>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-slate-200/60">
                                <span className="text-slate-900 font-bold font-sans block mb-1">3. Kepala Sekolah</span>
                                <span className="text-slate-500">bu_sari@edupolicy.go.id &middot; Password123</span>
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
            <div className="min-h-screen bg-slate-50 flex flex-col text-gray-900 font-sans p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8">
                {/* Header */}
                <div className="flex justify-between items-center pb-6 border-b border-slate-200/70">
                    <div className="flex items-center gap-4">
                        <img src={logoSentraAI} alt="SENTRA-AI Logo" className="h-12 w-auto object-contain" />
                        <div>
                            <span className="text-[10px] font-bold text-blue-600 tracking-widest uppercase bg-blue-50 px-2.5 py-1 rounded-full">Portal Kepala Sekolah</span>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-3">
                                {principalSchool?.name || 'Sekolah Anda'}
                            </h2>
                            <span className="text-xs text-slate-400 font-medium mt-1 block">NPSN: {principalSchool?.npsn || '...'} &middot; {principalSchool?.district || '...'}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all duration-150 shadow-sm"
                    >
                        Keluar Sesi ({userName})
                    </button>
                </div>

                {/* Main Stats Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Radial Health Indicator */}
                    <div className="bg-white border border-slate-200/70 rounded-2xl p-8 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.08)] flex flex-col items-center justify-center space-y-6 card-lift">
                        <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Skor Kesehatan Sekolah</span>
                        
                        <div className="relative w-44 h-44 flex items-center justify-center">
                            {/* Circular gauge with gradient stroke */}
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                                <defs>
                                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor={compScore < 60 ? '#f87171' : compScore < 80 ? '#fbbf24' : '#34d399'} />
                                        <stop offset="100%" stopColor={compScore < 60 ? '#ef4444' : compScore < 80 ? '#f59e0b' : '#10b981'} />
                                    </linearGradient>
                                </defs>
                                <circle cx="90" cy="90" r="78" stroke="#e2e8f0" strokeWidth="10" fill="transparent" />
                                <circle 
                                    cx="90" 
                                    cy="90" 
                                    r="78" 
                                    stroke="url(#gaugeGradient)" 
                                    strokeWidth="10" 
                                    fill="transparent"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 78}`}
                                    strokeDashoffset={`${2 * Math.PI * 78 * (1 - compScore / 100)}`}
                                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                                />
                            </svg>
                            <div className="absolute text-center">
                                <span className={`text-4xl font-black ${compScore < 60 ? 'text-red-500' : compScore < 80 ? 'text-amber-500' : 'text-emerald-600'}`}>{compScore.toFixed(0)}</span>
                                <span className="block text-[10px] font-semibold text-slate-400 tracking-wider mt-1">/ 100</span>
                            </div>
                        </div>

                        <span className="text-[10px] text-slate-400 text-center leading-relaxed">
                            Diperbarui dinamis dari survei orang tua &amp; data resmi Dapodik.
                        </span>
                    </div>

                    {/* Dimension Breakdown */}
                    <div className="lg:col-span-2 bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.08)] space-y-6 card-lift">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 tracking-tight">Rincian Skor Per Dimensi</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Dibandingkan dengan rata-rata kabupaten</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { key: 'academic', label: 'Akademik', score: breakdown.academic || 50 },
                                { key: 'teacher', label: 'Guru & Tenaga GTK', score: breakdown.teacher || 50 },
                                { key: 'infrastructure', label: 'Sarpras & Fasilitas', score: breakdown.infrastructure || 50 },
                                { key: 'finance', label: 'Transparansi Keuangan', score: breakdown.finance || 50 },
                                { key: 'studentWelfare', label: 'Keamanan & Anti-Bullying', score: breakdown.studentWelfare || 50 },
                                { key: 'parentSatisfaction', label: 'Kepuasan Orang Tua', score: breakdown.parentSatisfaction || 50 }
                            ].map(d => {
                                const s = Number(d.score);
                                const color = s < 50 ? 'text-red-500' : s < 70 ? 'text-amber-500' : 'text-emerald-600';
                                const barColor = s < 50 ? 'from-red-400 to-red-500' : s < 70 ? 'from-amber-400 to-amber-500' : 'from-emerald-400 to-emerald-500';
                                return (
                                    <div key={d.key} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-2.5 hover:bg-white hover:shadow-sm transition-all duration-150">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-slate-700">{d.label}</span>
                                            <span className={`text-sm font-bold ${color}`}>{s.toFixed(0)}</span>
                                        </div>
                                        <div className="h-2 bg-slate-200/70 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all duration-700`}
                                                style={{ width: `${s}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Ground Truth Warning Flags */}
                <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] space-y-4">
                    <div>
                        <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">Validasi Data</p>
                        <h3 className="text-sm font-bold text-slate-800 tracking-tight">Inkonsistensi Data (Ground Truth Flags)</h3>
                    </div>
                    
                    {principalFlags.length > 0 ? (
                        <div className="space-y-3">
                            {principalFlags.map(f => (
                                <div key={f.flag_id} className="bg-red-50/80 border border-red-200/70 p-4 rounded-xl flex items-start gap-3">
                                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-bold text-red-700 tracking-wide">Diskrepansi: {f.indicator}</span>
                                        <p className="text-xs text-red-600 mt-1 leading-relaxed">
                                            Dapodik mencatat ({f.official_value}%) namun persepsi orang tua hanya ({f.parent_value}%). Gap: <strong>{f.gap_score.toFixed(1)}σ</strong>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-emerald-50/80 border border-emerald-200/70 p-5 rounded-xl flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <span className="block text-xs font-bold text-emerald-800">Tidak Ada Inkonsistensi</span>
                                <span className="text-[10px] text-emerald-700 mt-0.5 block">Data Dapodik sejalan dengan persepsi nyata orang tua.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Complaints Section & Response (BR-07 compliant: no parent identity exposed) */}
                <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] space-y-6">
                    <div>
                        <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">Manajemen Aduan</p>
                        <h3 className="text-sm font-bold text-slate-800 tracking-tight">Pengaduan Masuk &amp; Tindak Lanjut</h3>
                    </div>

                    {complaints.length > 0 ? (
                        <div className="space-y-4">
                            {complaints.map(c => (
                                <div key={c.complaint_id} className="bg-slate-50/60 border border-slate-200/60 p-5 rounded-2xl flex flex-col md:flex-row justify-between gap-6 hover:bg-white hover:shadow-sm transition-all duration-200">
                                    <div className="space-y-3 flex-1">
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] tracking-widest uppercase">{c.category}</span>
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${c.urgency === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {c.urgency}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-800 font-medium leading-relaxed">{c.text}</p>
                                        
                                        {c.explanation && (
                                            <div className="bg-blue-50/60 border-l-2 border-blue-400 p-3 rounded-r-lg text-[10px] text-blue-800 leading-relaxed">
                                                <strong>💡 Analisis AI:</strong> {c.explanation}
                                            </div>
                                        )}
                                        
                                        {c.suggested_response && (
                                            <div className="bg-slate-900 border border-slate-700/50 p-3.5 rounded-xl text-[10px] leading-relaxed space-y-1.5">
                                                <strong className="text-slate-300 block font-sans tracking-wide">📝 Draf Tanggapan Empati:</strong>
                                                <p className="whitespace-pre-wrap text-slate-400 font-mono">{c.suggested_response}</p>
                                            </div>
                                        )}

                                        <span className="block text-[9px] text-slate-400 pt-1">Masuk: {new Date(c.created_at).toLocaleString('id-ID')}</span>
                                    </div>

                                    {/* Action Form */}
                                    <div className="w-full md:w-52 shrink-0 flex flex-col justify-center space-y-3">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Status Pengaduan</label>
                                            <select
                                                value={newStatusValue[c.complaint_id] || c.status}
                                                onChange={e => setNewStatusValue({
                                                    ...newStatusValue,
                                                    [c.complaint_id]: e.target.value
                                                })}
                                                disabled={c.status === 'Resolved'}
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-slate-900 px-3 py-2.5 rounded-xl outline-none text-xs transition-all duration-200"
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
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 text-[10px] btn-glow-blue"
                                            >
                                                {updatingComplaintId === c.complaint_id ? 'Menyimpan...' : 'Perbarui Status'}
                                            </button>
                                        )}
                                        {c.status === 'Resolved' && (
                                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200/70">
                                                <CheckCircle className="w-3.5 h-3.5" /> Sudah Ditangani
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                <CheckCircle className="w-7 h-7 text-slate-400" />
                            </div>
                            <p className="text-sm font-semibold text-slate-600">Tidak Ada Pengaduan</p>
                            <p className="text-xs text-slate-400 mt-1.5 max-w-xs">Belum ada pengaduan terdaftar untuk sekolah Anda pada bulan ini.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Authenticated Dinas Analyst / Supervisor Dashboard View
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-gray-900 font-sans">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 bg-white border-r border-slate-200/80 flex flex-col p-6 space-y-8 shadow-[1px_0_0_rgba(15,23,42,0.06)]">
                <div className="flex items-center gap-3">
                    <img src={logoSentraAI} alt="SENTRA-AI Logo" className="h-8 w-auto object-contain" />
                    <div>
                        <h1 className="text-sm font-bold tracking-tight text-slate-900">SENTRA-AI</h1>
                        <span className="text-[10px] text-slate-400 font-medium tracking-wide">KAB. MALANG</span>
                    </div>
                </div>

                <nav className="flex-1 flex flex-col space-y-0.5">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150 ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.28)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Ringkasan & Peta Risiko
                    </button>
                    {userRole !== 'Supervisor' && (
                        <button
                            onClick={() => setActiveTab('simulation')}
                            className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150 ${activeTab === 'simulation' ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.28)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                        >
                            <Calculator className="w-4 h-4" />
                            Simulasi Kebijakan
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('recommendations')}
                        className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150 ${activeTab === 'recommendations' ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.28)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Rekomendasi & Alerts
                    </button>
                    {userRole !== 'Supervisor' && (
                        <button
                            onClick={() => setActiveTab('complaints')}
                            className={`flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-150 ${activeTab === 'complaints' ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(59,130,246,0.28)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
                        >
                            <FileText className="w-4 h-4" />
                            Pengaduan Masuk (AI)
                        </button>
                    )}
                </nav>

                <div className="pt-5 border-t border-slate-100 flex justify-between items-center">
                    <div>
                        <span className="text-[10px] text-slate-400 block font-semibold tracking-widest uppercase mb-1">Pengguna Aktif</span>
                        <span className="text-xs font-bold text-slate-800">{userName}</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-[10px] font-semibold text-slate-400 hover:text-red-500 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-all duration-150"
                    >
                        Log Out
                    </button>
                </div>
            </aside>

            {/* Main Section */}
            <main className="flex-1 p-8 md:p-12 overflow-y-auto max-w-7xl mx-auto w-full">
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-fadein">
                        <div>
                            <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">Dashboard Utama</p>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ringkasan & Peta Risiko</h2>
                            <p className="text-sm text-slate-500 mt-1.5">Daftar kesehatan sekolah, deteksi gap data, dan sebaran geografis sekolah di Jawa Timur.</p>
                        </div>

                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200 border-l-4 border-l-blue-500">
                                <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Rata Kesehatan Sekolah</span>
                                <div className="text-3xl font-extrabold text-slate-900 mt-2">72.6 <span className="text-xs text-slate-400 font-medium">/100</span></div>
                            </div>
                            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200 border-l-4 border-l-amber-400">
                                <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Peringatan Dini (Aktif)</span>
                                <div className="text-3xl font-extrabold text-amber-500 mt-2">{alerts.filter(a => a.status === 'Open').length} <span className="text-xs text-slate-400 font-medium">Kasus</span></div>
                            </div>
                            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200 border-l-4 border-l-red-400">
                                <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Anomali Data</span>
                                <div className="text-3xl font-extrabold text-red-500 mt-2">4 <span className="text-xs text-slate-400 font-medium">Sekolah</span></div>
                            </div>
                            <div className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow duration-200 border-l-4 border-l-emerald-400">
                                <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Respons Orang Tua</span>
                                <div className="text-3xl font-extrabold text-emerald-600 mt-2">84.2<span className="text-xs text-slate-400 font-medium">%</span></div>
                            </div>
                        </div>

                        {/* Map & List */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white border border-slate-200/70 rounded-2xl shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] overflow-hidden p-6 space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 tracking-tight">Sebaran Geografis Titik Sekolah</h3>
                                <div id="map-container" className="h-96 rounded-xl border border-slate-200/70 z-10"></div>
                            </div>

                            <div className="bg-white border border-slate-200/70 rounded-2xl shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] p-6 space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 tracking-tight">Daftar NPSN Sekolah</h3>
                                <div className="space-y-2 max-h-[380px] overflow-y-auto">
                                    {schools.map(s => (
                                        <button
                                            key={s.school_id}
                                            onClick={() => setSelectedSchoolId(s.school_id)}
                                            className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 text-xs ${selectedSchoolId === s.school_id ? 'border-blue-500 bg-blue-50 shadow-[0_2px_8px_rgba(59,130,246,0.15)]' : 'border-slate-200/70 hover:bg-slate-50 hover:border-slate-300'}`}
                                        >
                                            <span className="block font-semibold text-slate-900">{s.name}</span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 block">NPSN: {s.npsn} &middot; {s.district}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'simulation' && (
                    <div className="space-y-8 animate-fadein">
                        <div>
                            <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">Analisis Kebijakan</p>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Simulasi Dampak Kebijakan</h2>
                            <p className="text-sm text-slate-500 mt-1.5">Uji dampak elastisitas peningkatan anggaran atau penambahan guru secara real-time.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="bg-white border border-slate-200/70 rounded-2xl shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] p-6">
                                <h3 className="text-sm font-bold text-gray-800 tracking-tight mb-6">Konfigurasi Intervensi</h3>
                                <form onSubmit={handleRunSimulation} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 tracking-wider uppercase mb-2">PILIH SEKOLAH</label>
                                        <select
                                            value={selectedSchoolId}
                                            onChange={e => setSelectedSchoolId(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 px-4 py-3 rounded-xl transition-all duration-200 outline-none text-xs"
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
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 px-4 py-3 rounded-xl transition-all duration-200 outline-none text-xs"
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
                                            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 px-4 py-3 rounded-xl transition-all duration-200 outline-none text-xs"
                                            required
                                        />
                                        <span className="text-[9px] text-gray-400 mt-2 block">Masukkan jumlah guru, persentase BOS (%), atau nominal rupiah sarpras.</span>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={simulating}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3.5 rounded-xl transition-all duration-150 text-xs btn-glow-blue flex items-center justify-center gap-2"
                                    >
                                        {simulating ? 'Sedang Memproyeksikan...' : 'Proyeksikan Dampak'}
                                    </button>
                                </form>
                            </div>

                            <div className="lg:col-span-2 bg-white border border-slate-200/70 rounded-2xl shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] p-6 space-y-6">
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
                    <div className="space-y-8 animate-fadein">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">Prioritas Intervensi</p>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Rekomendasi & Alerts</h2>
                                <p className="text-sm text-slate-500 mt-1.5">Rangking alokasi intervensi dinas hasil perhitungan Multi-Criteria Decision Analysis.</p>
                            </div>
                            <a
                                href="http://localhost:8000/api/v1/recommendations/export?period=2026-07"
                                download
                                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 text-xs shadow-sm flex items-center gap-2 max-w-fit hover:shadow-md"
                            >
                                <Download className="w-4 h-4" /> Unduh CSV Rekomendasi
                            </a>
                        </div>

                        {/* Recommendations Table */}
                        <div className="bg-white border border-slate-200/70 rounded-2xl shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold text-[10px] tracking-widest uppercase">
                                        <th className="p-4 w-12 text-center">Rank</th>
                                        <th className="p-4">Nama Sekolah</th>
                                        <th className="p-4">Distrik</th>
                                        <th className="p-4 w-28 text-center">Health Score</th>
                                        <th className="p-4">Intervensi</th>
                                        <th className="p-4">Rationale</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {recs.map(r => {
                                        const compScore = r.score_components?.compositeScore !== undefined 
                                            ? Number(r.score_components.compositeScore) 
                                            : 0;
                                        const intervention = r.score_components?.recommendedIntervention || 'N/A';
                                        
                                        return (
                                            <tr key={r.recommendation_id} className="hover:bg-slate-50/70 transition-colors duration-100">
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-600 text-white font-bold rounded-full text-[10px]">{r.rank}</span>
                                                </td>
                                                <td className="p-4 font-semibold text-slate-900">{r.school_name}</td>
                                                <td className="p-4 text-slate-500">{r.district}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`font-bold text-sm ${compScore < 60 ? 'text-red-500' : compScore < 80 ? 'text-amber-500' : 'text-emerald-600'}`}>{compScore.toFixed(0)}</span>
                                                    <span className="text-slate-400 text-xs">/100</span>
                                                </td>
                                                <td className="p-4 font-medium text-slate-800">{intervention}</td>
                                                <td className="p-4 text-slate-500 max-w-xs leading-relaxed">{r.rationale}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Alerts Management Section */}
                        <div className="space-y-5">
                            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Peringatan Dini & Kunjungan Lapangan</h3>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white border border-slate-200/70 rounded-2xl shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] overflow-hidden">
                                    <div className="p-4 bg-slate-50 border-b border-slate-200/80 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                        Daftar Alert Aktif
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                                        {alerts.map(a => (
                                            <div key={a.alert_id} className="p-4 flex justify-between items-center text-xs hover:bg-slate-50/50 transition-colors duration-100">
                                                <div className="space-y-1">
                                                    <span className="font-semibold text-slate-900">{a.school_name || 'SDN Lowokwaru 1'}</span>
                                                    <div className="flex gap-2 items-center text-[10px] text-slate-400">
                                                        <span className={`font-bold uppercase ${a.severity === 'Critical' ? 'text-red-500' : 'text-amber-500'}`}>{a.severity}</span>
                                                        <span>&middot;</span>
                                                        <span>{new Date(a.opened_at).toLocaleString('id-ID')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 items-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${a.status === 'Closed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        {a.status === 'Closed' ? 'Selesai' : 'Aktif'}
                                                    </span>
                                                    {a.status === 'Open' && (userRole === 'Admin' || userRole === 'Supervisor') && (
                                                        <button
                                                            onClick={() => setResolvingAlertId(a.alert_id)}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-all duration-150 text-[10px] font-semibold shadow-sm"
                                                        >
                                                            Tindak Lanjut
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200/70 rounded-2xl shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] p-6">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Resolusi Peringatan Dini</h4>
                                    {!(userRole === 'Admin' || userRole === 'Supervisor') ? (
                                        <div className="h-48 flex flex-col items-center justify-center text-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                                <ShieldAlert className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium">Akses Terbatas</p>
                                            <p className="text-[10px] text-slate-400 max-w-[180px] leading-relaxed">Hanya Pengawas Lapangan dan Admin yang dapat mencatat tindak lanjut.</p>
                                        </div>
                                    ) : resolvingAlertId ? (
                                        <form onSubmit={handleResolveAlert} className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">Catatan Kunjungan Pengawas</label>
                                                <textarea
                                                    placeholder="Tuliskan hasil penyidikan atau pembinaan di lapangan..."
                                                    value={visitNote}
                                                    onChange={e => setVisitNote(e.target.value)}
                                                    rows={4}
                                                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10 text-gray-900 p-3 rounded-xl transition-all duration-200 outline-none text-xs"
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all duration-150 text-xs btn-glow-blue"
                                            >
                                                Simpan & Tutup Alert
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="h-48 flex flex-col items-center justify-center text-center gap-3">
                                            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                                                <ShieldAlert className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium">Pilih alert aktif</p>
                                            <p className="text-[10px] text-slate-400 max-w-[160px] leading-relaxed">Klik "Tindak Lanjut" pada daftar alert untuk mencatat resolusi.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'complaints' && (
                    <div className="space-y-8 animate-fadein">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-1">Manajemen Aduan</p>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Pengaduan Masuk (Inbound Review)</h2>
                                <p className="text-sm text-slate-500 mt-1.5">Daftar laporan orang tua yang didekripsi secara aman dengan analisis sentimen, kategori, dan kemiripan AI.</p>
                            </div>
                            {userRole === 'Admin' && (
                                <button
                                    onClick={handleTriggerTraining}
                                    disabled={training}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold px-4 py-2.5 rounded-xl transition-all duration-150 text-xs shadow-sm flex items-center gap-2 max-w-fit btn-glow-blue"
                                >
                                    <RefreshCw className={`w-4 h-4 ${training ? 'animate-spin' : ''}`} /> Latih Ulang AI Klasifikasi
                                </button>
                            )}
                        </div>

                        {trainingLogs && (
                            <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl">
                                <span className="block text-[10px] font-semibold text-slate-400 tracking-widest uppercase mb-2">📊 Log Retraining & Hot-Reload</span>
                                <pre className="text-[10px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">{trainingLogs}</pre>
                            </div>
                        )}

                        {/* Complaints Card List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {complaints.map(c => (
                                <div key={c.complaint_id} className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.07)] hover:shadow-[0_4px_20px_-4px_rgba(15,23,42,0.10)] transition-shadow duration-200 flex flex-col justify-between space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center gap-2">
                                            <span className="text-[10px] font-bold text-blue-600 tracking-widest uppercase bg-blue-50 px-2.5 py-1 rounded-full">{c.category}</span>
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${c.urgency === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {c.urgency}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-800 leading-relaxed font-medium">{c.text}</p>

                                        {c.explanation && (
                                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2.5 rounded-r-lg text-[10px] text-blue-800 leading-relaxed mt-2">
                                                <strong>💡 Analisis AI:</strong> {c.explanation}
                                            </div>
                                        )}

                                        {c.suggested_response && (
                                            <div className="bg-slate-900 border border-slate-700/50 p-3.5 rounded-xl text-[10px] leading-relaxed mt-2 space-y-1.5">
                                                <strong className="text-slate-300 block font-sans tracking-wide">📝 Draf Tanggapan Empati:</strong>
                                                <p className="whitespace-pre-wrap text-slate-400 font-mono">{c.suggested_response}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                                        <span>Sentimen: <strong className="text-slate-600">{c.sentiment}</strong></span>
                                        <span className={`px-2 py-0.5 rounded-full font-semibold ${c.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600' : c.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{c.status}</span>
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
