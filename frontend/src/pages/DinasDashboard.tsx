import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '../utils/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import logoSentraAI from '../assets/SENTRAI.png';
import { Icon } from '@iconify/react';


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

    // Load data if authenticated — tunggu sampai BOTH token DAN userRole tersedia
    useEffect(() => {
        if (token && userRole) {
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
                const role = data.user.role;
                const districtScope = data.user.districtScope;

                localStorage.setItem('token', data.token);
                localStorage.setItem('userName', data.user.name);
                localStorage.setItem('userRole', role);
                localStorage.setItem('userDistrictScope', districtScope);
                
                // Set semua state sekaligus — React akan batch update ini
                setToken(data.token);
                setUserName(data.user.name);
                setUserRole(role);
                setUserDistrictScope(districtScope);
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
            <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 font-['Poppins',_sans-serif]">
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="w-full max-w-[400px] space-y-7">

                        {/* Logo Only */}
                        <div className="flex justify-center">
                            <img src={logoSentraAI} alt="SENTRA-AI" className="h-14 w-auto object-contain" />
                        </div>

                        {/* Error */}
                        {loginError && (
                            <div className="bg-rose-50 border border-rose-200/80 text-rose-700 text-[13px] p-3.5 rounded-xl flex items-center gap-3">
                                <Icon icon="solar:danger-circle-bold-duotone" className="w-[18px] h-[18px] shrink-0 text-rose-500" />
                                <span>{loginError}</span>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="block text-[13px] font-semibold text-slate-700">
                                    Alamat Email
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Icon icon="solar:letter-bold-duotone" className="w-[18px] h-[18px] text-slate-400" />
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="nama@edupolicy.go.id"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/8 text-slate-900 pl-10 pr-4 py-3 rounded-xl transition-all duration-200 outline-none text-[14px] placeholder:text-slate-400"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="block text-[13px] font-semibold text-slate-700">
                                    Kata Sandi
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <Icon icon="solar:lock-password-bold-duotone" className="w-[18px] h-[18px] text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/8 text-slate-900 pl-10 pr-4 py-3 rounded-xl transition-all duration-200 outline-none text-[14px] placeholder:text-slate-400"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-[14px] flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(59,130,246,0.35)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.45)]"
                            >
                                Login
                            </button>
                        </form>



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
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-800 font-['Poppins',_sans-serif] p-8 md:p-12 max-w-7xl mx-auto w-full space-y-8 animate-fadein">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-200/60">
                    <div>
                        <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 shadow-sm">
                                <img src={logoSentraAI} alt="SENTRA-AI Logo" className="h-4 w-auto object-contain" />
                            </div>
                            <span className="text-[10px] font-bold text-blue-600 tracking-widest uppercase">Sentra AI &middot; Portal Kepala Sekolah</span>
                        </div>
                        <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Kinerja & Validasi Sekolah</h2>
                        <p className="text-[13px] text-slate-500 mt-1">Pantau indikator kinerja, validasi data Dapodik, dan tangani pengaduan orang tua.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                        {/* School Profile Box */}
                        <div className="flex items-center gap-3.5 bg-white border border-slate-200/60 rounded-xl p-2.5 pr-5 shadow-sm">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-100">
                                <Icon icon="solar:buildings-bold-duotone" className="w-[20px] h-[20px] text-slate-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[13px] font-semibold text-slate-800 leading-tight">{principalSchool?.name || 'Sekolah Anda'}</span>
                                <span className="text-[11px] text-slate-500 mt-0.5">{principalSchool?.district || '...'} &middot; NPSN: {principalSchool?.npsn || '...'}</span>
                            </div>
                        </div>

                        {/* User Actions */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-3 border-l border-slate-200/80 pl-6">
                                <div className="flex flex-col text-right">
                                    <span className="text-[13px] font-semibold text-slate-800 truncate">{userName}</span>
                                    <span className="text-[10px] text-slate-500 font-medium truncate">Kepala Sekolah</span>
                                </div>
                                <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                    {userName.charAt(0)}
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white border border-slate-200/60 text-slate-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-colors shadow-sm ml-2"
                                title="Keluar Sesi"
                            >
                                <Icon icon="solar:logout-3-bold-duotone" className="w-[20px] h-[20px] scale-x-[-1]" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Stats Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Radial Health Indicator */}
                    <div className="bg-white border border-slate-200/60 rounded-2xl p-8 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] flex flex-col items-center justify-center space-y-6 hover:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.08)] transition-all duration-300">
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:heart-pulse-bold-duotone" className="w-[20px] h-[20px] text-rose-500" />
                            <span className="text-[14px] font-bold text-slate-800">Skor Kesehatan Sekolah</span>
                        </div>
                        
                        <div className="relative w-44 h-44 flex items-center justify-center">
                            {/* Circular gauge with gradient stroke */}
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                                <defs>
                                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor={compScore < 60 ? '#f43f5e' : compScore < 80 ? '#f59e0b' : '#10b981'} />
                                        <stop offset="100%" stopColor={compScore < 60 ? '#e11d48' : compScore < 80 ? '#d97706' : '#059669'} />
                                    </linearGradient>
                                </defs>
                                <circle cx="90" cy="90" r="78" stroke="#f1f5f9" strokeWidth="12" fill="transparent" />
                                <circle 
                                    cx="90" 
                                    cy="90" 
                                    r="78" 
                                    stroke="url(#gaugeGradient)" 
                                    strokeWidth="12" 
                                    fill="transparent"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 78}`}
                                    strokeDashoffset={`${2 * Math.PI * 78 * (1 - compScore / 100)}`}
                                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                                <span className={`text-4xl font-black ${compScore < 60 ? 'text-rose-500' : compScore < 80 ? 'text-amber-500' : 'text-emerald-600'}`}>{compScore.toFixed(0)}</span>
                                <span className="text-[12px] font-semibold text-slate-400 mt-0.5">dari 100</span>
                            </div>
                        </div>

                        <span className="text-[12px] text-slate-500 text-center leading-relaxed">
                            Diperbarui dinamis dari sentimen orang tua &amp; data resmi Dapodik.
                        </span>
                    </div>

                    {/* Dimension Breakdown */}
                    <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] space-y-6 hover:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.08)] transition-all duration-300">
                        <div className="flex items-center gap-2">
                            <Icon icon="solar:chart-pie-bold-duotone" className="w-[20px] h-[20px] text-blue-500" />
                            <div>
                                <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">Rincian Skor Per Dimensi</h3>
                                <p className="text-[12px] text-slate-500 mt-0.5">Dibandingkan dengan rata-rata kinerja sekolah se-kabupaten</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { key: 'academic', label: 'Akademik', icon: 'solar:book-bookmark-bold-duotone', score: breakdown.academic || 50 },
                                { key: 'teacher', label: 'Guru & Tenaga GTK', icon: 'solar:users-group-two-rounded-bold-duotone', score: breakdown.teacher || 50 },
                                { key: 'infrastructure', label: 'Sarpras & Fasilitas', icon: 'solar:buildings-bold-duotone', score: breakdown.infrastructure || 50 },
                                { key: 'finance', label: 'Transparansi Keuangan', icon: 'solar:wallet-money-bold-duotone', score: breakdown.finance || 50 },
                                { key: 'studentWelfare', label: 'Keamanan & Anti-Bullying', icon: 'solar:shield-star-bold-duotone', score: breakdown.studentWelfare || 50 },
                                { key: 'parentSatisfaction', label: 'Kepuasan Orang Tua', icon: 'solar:emoji-funny-circle-bold-duotone', score: breakdown.parentSatisfaction || 50 }
                            ].map(d => {
                                const s = Number(d.score);
                                const color = s < 50 ? 'text-rose-500' : s < 70 ? 'text-amber-500' : 'text-emerald-600';
                                const barColor = s < 50 ? 'from-rose-400 to-rose-500' : s < 70 ? 'from-amber-400 to-amber-500' : 'from-emerald-400 to-emerald-500';
                                return (
                                    <div key={d.key} className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 space-y-3 hover:bg-white hover:border-slate-300/60 transition-all duration-200">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <Icon icon={d.icon} className="w-[16px] h-[16px] text-slate-400" />
                                                <span className="text-[13px] font-bold text-slate-700">{d.label}</span>
                                            </div>
                                            <span className={`text-[14px] font-black ${color}`}>{s.toFixed(0)}</span>
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
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] space-y-5">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:shield-warning-bold-duotone" className="w-[20px] h-[20px] text-amber-500" />
                        <div>
                            <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">Validasi & Inkonsistensi Data (Ground Truth Flags)</h3>
                            <p className="text-[12px] text-slate-500 mt-0.5">Analisis kesenjangan antara data laporan Dapodik dan realitas lapangan (survei orang tua).</p>
                        </div>
                    </div>
                    
                    {principalFlags.length > 0 ? (
                        <div className="space-y-4">
                            {principalFlags.map(f => (
                                <div key={f.flag_id} className="bg-rose-50/60 border border-rose-200/60 p-4 rounded-xl flex items-start gap-4 hover:shadow-sm transition-all duration-200">
                                    <div className="w-10 h-10 bg-white border border-rose-100 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                        <Icon icon="solar:danger-triangle-bold-duotone" className="w-[22px] h-[22px] text-rose-500" />
                                    </div>
                                    <div className="flex-1">
                                        <span className="block text-[13px] font-bold text-rose-700 tracking-wide mb-1">Diskrepansi: {f.indicator}</span>
                                        <p className="text-[12px] text-slate-700 leading-relaxed bg-white/50 p-2.5 rounded-lg border border-rose-100/50 mt-2">
                                            Laporan Dapodik mencatat tingkat pencapaian <strong>{Number(f.official_value).toFixed(0)}%</strong>, namun sentimen orang tua mengindikasikan hanya <strong>{Number(f.parent_value).toFixed(0)}%</strong>. 
                                            Hal ini menghasilkan skor anomali sebesar <strong className="text-rose-600">{Number(f.gap_score).toFixed(1)}σ</strong>.
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-emerald-50/80 border border-emerald-200/70 p-5 rounded-xl flex items-center gap-4">
                            <div className="w-12 h-12 bg-white border border-emerald-100 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                                <Icon icon="solar:check-circle-bold-duotone" className="w-[24px] h-[24px] text-emerald-500" />
                            </div>
                            <div>
                                <span className="block text-[14px] font-bold text-emerald-800">Tidak Ada Inkonsistensi Terdeteksi</span>
                                <span className="text-[12px] text-emerald-700 mt-1 block">Laporan Dapodik Anda sejalan dan sinkron dengan persepsi positif dari orang tua murid.</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Complaints Section & Response (BR-07 compliant: no parent identity exposed) */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100/80 pb-4">
                        <div className="p-1.5 bg-blue-50/80 rounded-lg">
                            <Icon icon="solar:chat-round-unread-bold-duotone" className="w-[20px] h-[20px] text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-[16px] font-bold text-slate-800 tracking-tight">Pengaduan Masuk & Tindak Lanjut</h3>
                            <p className="text-[12px] text-slate-500 mt-0.5">Tanggapi keluhan tanpa mengetahui identitas pelapor demi objektivitas.</p>
                        </div>
                    </div>

                    {complaints.length > 0 ? (
                        <div className="space-y-5">
                            {complaints.map(c => (
                                <div key={c.complaint_id} className="bg-white border border-slate-200/60 p-5 rounded-2xl flex flex-col lg:flex-row justify-between gap-6 hover:shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)] transition-all duration-300">
                                    <div className="space-y-4 flex-1">
                                        <div className="flex gap-2 items-center flex-wrap">
                                            <div className="flex items-center gap-1.5">
                                                <Icon icon="solar:tag-horizontal-bold-duotone" className="w-[14px] h-[14px] text-indigo-400" />
                                                <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 font-bold text-[11px] ring-1 ring-indigo-100">{c.category}</span>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${c.urgency === 'Critical' ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/60'}`}>
                                                <Icon icon={c.urgency === 'Critical' ? 'solar:danger-circle-bold' : 'solar:info-circle-bold'} className="w-[12px] h-[12px]" />
                                                {c.urgency}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-medium ml-auto bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                                                Masuk: {new Date(c.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        
                                        <div className="relative">
                                            <Icon icon="solar:quote-left-bold-duotone" className="w-6 h-6 text-slate-100 absolute -top-1 -left-2 -z-10" />
                                            <p className="text-[13px] text-slate-700 font-medium leading-relaxed relative z-10">{c.text}</p>
                                        </div>
                                        
                                        {c.explanation && (
                                            <div className="bg-indigo-50/50 border-l-[3px] border-indigo-400 p-3 rounded-r-xl mt-3">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Icon icon="solar:magic-stick-3-bold-duotone" className="w-[14px] h-[14px] text-indigo-500" />
                                                    <strong className="text-[11px] text-indigo-700 font-bold">Analisis Sentimen AI</strong>
                                                </div>
                                                <p className="text-[12px] text-slate-600 leading-relaxed">{c.explanation}</p>
                                            </div>
                                        )}
                                        
                                        {c.suggested_response && (
                                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl mt-2 space-y-2 relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                                    <Icon icon="solar:pen-new-square-bold-duotone" className="w-16 h-16 text-white" />
                                                </div>
                                                <div className="flex items-center gap-1.5 relative z-10">
                                                    <Icon icon="solar:letter-bold-duotone" className="w-[14px] h-[14px] text-slate-300" />
                                                    <strong className="text-[11px] text-slate-300 font-semibold tracking-wide">Draf Tanggapan Empati (AI Generated)</strong>
                                                </div>
                                                <p className="whitespace-pre-wrap text-[12px] text-slate-400 font-mono leading-relaxed relative z-10">{c.suggested_response}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Form */}
                                    <div className="w-full lg:w-64 shrink-0 flex flex-col justify-center space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
                                        <div>
                                            <label className="flex items-center gap-1.5 text-[12px] font-bold text-slate-700 mb-2">
                                                <Icon icon="solar:checklist-minimalistic-bold-duotone" className="w-[14px] h-[14px] text-slate-400" />
                                                Perbarui Status
                                            </label>
                                            <select
                                                value={newStatusValue[c.complaint_id] || c.status}
                                                onChange={e => setNewStatusValue({
                                                    ...newStatusValue,
                                                    [c.complaint_id]: e.target.value
                                                })}
                                                disabled={c.status === 'Resolved'}
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-800 px-3.5 py-3 rounded-xl outline-none text-[13px] font-medium transition-all duration-200 cursor-pointer disabled:opacity-70"
                                            >
                                                <option value="Received">📥 Diterima (Received)</option>
                                                <option value="Acknowledged">👀 Diketahui (Acknowledged)</option>
                                                <option value="In Progress">⏳ Diproses (In Progress)</option>
                                                <option value="Resolved">✅ Selesai (Resolved)</option>
                                            </select>
                                        </div>
                                        {c.status !== 'Resolved' && (
                                            <button
                                                onClick={() => handleUpdateComplaintStatus(c.complaint_id)}
                                                disabled={updatingComplaintId === c.complaint_id}
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-[13px] shadow-sm flex justify-center items-center gap-2"
                                            >
                                                {updatingComplaintId === c.complaint_id ? (
                                                    <span className="flex items-center gap-2">
                                                        <Icon icon="solar:restart-bold-duotone" className="w-[16px] h-[16px] animate-spin" />
                                                        Menyimpan...
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-2">
                                                        <Icon icon="solar:diskette-bold-duotone" className="w-[16px] h-[16px]" />
                                                        Simpan Status
                                                    </span>
                                                )}
                                            </button>
                                        )}
                                        {c.status === 'Resolved' && (
                                            <div className="flex items-center justify-center gap-2 text-[12px] text-emerald-700 font-bold bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200/70">
                                                <Icon icon="solar:check-circle-bold-duotone" className="w-[18px] h-[18px]" /> 
                                                Telah Ditangani
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                            <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                <Icon icon="solar:box-minimalistic-bold-duotone" className="w-[32px] h-[32px] text-slate-300" />
                            </div>
                            <p className="text-[15px] font-bold text-slate-700">Kotak Pengaduan Kosong</p>
                            <p className="text-[13px] text-slate-500 mt-1.5 max-w-sm">Belum ada pengaduan orang tua yang masuk untuk sekolah Anda pada bulan ini.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Authenticated Dinas Analyst / Supervisor Dashboard View
    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row text-slate-800 font-['Poppins',_sans-serif]">
            {/* Elegant Sidebar Navigation */}
            <aside className="w-full md:w-[260px] bg-white border-r border-slate-200/60 flex flex-col py-8 px-5 h-screen sticky top-0 shadow-[4px_0_24px_rgba(15,23,42,0.02)] z-20">
                {/* Brand Logo */}
                <div className="flex items-center gap-3.5 mb-10 px-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50">
                        <img src={logoSentraAI} alt="SENTRA-AI Logo" className="h-5 w-auto object-contain" />
                    </div>
                    <div>
                        <h1 className="text-[14px] font-bold tracking-tight text-slate-900 leading-tight">SENTRA-AI</h1>
                        <span className="text-[9px] text-blue-600 font-bold tracking-widest uppercase">Dinas Kab. Malang</span>
                    </div>
                </div>

                <div className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4 px-3">Menu Dashboard</div>
                <nav className="flex-1 flex flex-col space-y-1.5">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`group flex items-center gap-3.5 px-3 py-2.5 text-[13px] font-medium rounded-xl transition-all duration-200 relative overflow-hidden ${
                            activeTab === 'overview' 
                            ? 'text-blue-700 bg-blue-50/50' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                    >
                        {activeTab === 'overview' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />}
                        <Icon icon="solar:chart-square-bold-duotone" width="22" height="22" className={`transition-colors shrink-0 ${activeTab === 'overview' ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                        <span>Ringkasan & Peta</span>
                    </button>

                    {userRole !== 'Supervisor' && (
                        <button
                            onClick={() => setActiveTab('simulation')}
                            className={`group flex items-center gap-3.5 px-3 py-2.5 text-[13px] font-medium rounded-xl transition-all duration-200 relative overflow-hidden ${
                                activeTab === 'simulation' 
                                ? 'text-blue-700 bg-blue-50/50' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                        >
                            {activeTab === 'simulation' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />}
                            <Icon icon="solar:calculator-bold-duotone" width="22" height="22" className={`transition-colors shrink-0 ${activeTab === 'simulation' ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                            <span>Simulasi Kebijakan</span>
                        </button>
                    )}

                    <button
                        onClick={() => setActiveTab('recommendations')}
                        className={`group flex items-center gap-3.5 px-3 py-2.5 text-[13px] font-medium rounded-xl transition-all duration-200 relative overflow-hidden ${
                            activeTab === 'recommendations' 
                            ? 'text-blue-700 bg-blue-50/50' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                    >
                        {activeTab === 'recommendations' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />}
                        <Icon icon="solar:shield-warning-bold-duotone" width="22" height="22" className={`transition-colors shrink-0 ${activeTab === 'recommendations' ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                        <span>Rekomendasi & Alerts</span>
                    </button>

                    {userRole !== 'Supervisor' && (
                        <button
                            onClick={() => setActiveTab('complaints')}
                            className={`group flex items-center gap-3.5 px-3 py-2.5 text-[13px] font-medium rounded-xl transition-all duration-200 relative overflow-hidden ${
                                activeTab === 'complaints' 
                                ? 'text-blue-700 bg-blue-50/50' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                        >
                            {activeTab === 'complaints' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />}
                            <Icon icon="solar:document-text-bold-duotone" width="22" height="22" className={`transition-colors shrink-0 ${activeTab === 'complaints' ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                            <span>Pengaduan AI</span>
                        </button>
                    )}
                </nav>

                {/* User Profile Footer */}
                <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between items-center px-1">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                            {userName.charAt(0)}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[13px] font-semibold text-slate-800 truncate">{userName}</span>
                            <span className="text-[10px] text-slate-500 font-medium truncate">{userRole}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Keluar"
                    >
                        <Icon icon="solar:logout-2-bold-duotone" className="w-[22px] h-[22px]" />
                    </button>
                </div>
            </aside>

            {/* Main Section */}
            <main className="flex-1 p-8 md:p-12 overflow-y-auto max-w-7xl mx-auto w-full">
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-fadein">
                        <div>
                            <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">Ringkasan & Peta Risiko</h2>
                            <p className="text-[13px] text-slate-500 mt-1">Pantau kondisi sekolah, deteksi gap data, dan sebaran geografis wilayah binaan.</p>
                        </div>

                        {/* Minimalist KPI Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div className="bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col justify-between h-32 hover:border-slate-300 transition-colors">
                                <div className="flex justify-between items-start">
                                    <span className="text-[13px] font-medium text-slate-500 leading-tight">Rata-rata<br/>Kesehatan Sekolah</span>
                                    <div className="p-1.5 bg-blue-50 rounded-lg">
                                        <Icon icon="solar:health-bold-duotone" className="w-[18px] h-[18px] text-blue-500" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-2xl font-semibold text-slate-800">72.6<span className="text-xs text-slate-400 font-normal ml-1">/100</span></div>
                                </div>
                            </div>
                            
                            <div className="bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col justify-between h-32 hover:border-slate-300 transition-colors">
                                <div className="flex justify-between items-start">
                                    <span className="text-[13px] font-medium text-slate-500 leading-tight">Peringatan Dini<br/>(Kasus Aktif)</span>
                                    <div className="p-1.5 bg-amber-50 rounded-lg">
                                        <Icon icon="solar:danger-triangle-bold-duotone" className="w-[18px] h-[18px] text-amber-500" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-2xl font-semibold text-slate-800">{alerts.filter(a => a.status === 'Open').length}</div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col justify-between h-32 hover:border-slate-300 transition-colors">
                                <div className="flex justify-between items-start">
                                    <span className="text-[13px] font-medium text-slate-500 leading-tight">Anomali Data<br/>Dapodik vs Lapangan</span>
                                    <div className="p-1.5 bg-red-50 rounded-lg">
                                        <Icon icon="solar:shield-cross-bold-duotone" className="w-[18px] h-[18px] text-red-500" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-2xl font-semibold text-slate-800">4 <span className="text-xs text-slate-400 font-normal ml-0.5">Sekolah</span></div>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col justify-between h-32 hover:border-slate-300 transition-colors">
                                <div className="flex justify-between items-start">
                                    <span className="text-[13px] font-medium text-slate-500 leading-tight">Respons Survei<br/>Orang Tua</span>
                                    <div className="p-1.5 bg-emerald-50 rounded-lg">
                                        <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-[18px] h-[18px] text-emerald-500" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-2xl font-semibold text-slate-800">84.2<span className="text-xs text-slate-400 font-normal ml-0.5">%</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Map & List */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-xl p-5 flex flex-col shadow-sm">
                                <div className="mb-4 flex justify-between items-center">
                                    <h3 className="text-[14px] font-semibold text-slate-800">Sebaran Geografis</h3>
                                </div>
                                <div id="map-container" className="flex-1 min-h-[380px] rounded-lg border border-slate-200/50 z-10 overflow-hidden bg-slate-50"></div>
                            </div>

                            <div className="bg-white border border-slate-200/60 rounded-xl flex flex-col overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-slate-100/80 bg-slate-50/50">
                                    <h3 className="text-[14px] font-semibold text-slate-800">Daftar Sekolah Aktif</h3>
                                </div>
                                <div className="divide-y divide-slate-100/80 max-h-[400px] overflow-y-auto">
                                    {schools.map(s => (
                                        <button
                                            key={s.school_id}
                                            onClick={() => setSelectedSchoolId(s.school_id)}
                                            className={`w-full text-left px-5 py-3.5 transition-colors flex flex-col gap-1.5 relative ${
                                                selectedSchoolId === s.school_id 
                                                ? 'bg-blue-50/30' 
                                                : 'hover:bg-slate-50'
                                            }`}
                                        >
                                            {selectedSchoolId === s.school_id && (
                                                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500 rounded-r" />
                                            )}
                                            <span className={`text-[13px] font-medium leading-tight ${selectedSchoolId === s.school_id ? 'text-blue-700' : 'text-slate-700'}`}>
                                                {s.name}
                                            </span>
                                            <span className="text-[11px] text-slate-500 font-medium">NPSN: {s.npsn} &middot; {s.district}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'simulation' && (
                    <div className="space-y-8 animate-fadein">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-50/80 rounded-lg">
                                        <Icon icon="solar:calculator-minimalistic-bold-duotone" className="w-[22px] h-[22px] text-indigo-600" />
                                    </div>
                                    Simulasi Dampak Kebijakan
                                </h2>
                                <p className="text-[13px] text-slate-500 mt-1.5 ml-11">Uji elastisitas anggaran atau penambahan guru secara real-time terhadap performa sekolah.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="bg-white border border-slate-200/60 rounded-2xl p-1.5 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)]">
                                <div className="p-5 border-b border-slate-100/80 bg-slate-50/50 rounded-t-xl flex items-center gap-2">
                                    <Icon icon="solar:tuning-square-2-bold-duotone" className="w-[18px] h-[18px] text-slate-500" />
                                    <h3 className="text-[14px] font-bold text-slate-800">Konfigurasi Intervensi</h3>
                                </div>
                                <div className="p-5">
                                    <form onSubmit={handleRunSimulation} className="space-y-5">
                                        <div>
                                            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Pilih Sekolah Target</label>
                                            <select
                                                value={selectedSchoolId}
                                                onChange={e => setSelectedSchoolId(e.target.value)}
                                                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-700 px-3.5 py-2.5 rounded-xl transition-all duration-200 outline-none text-[13px] shadow-sm appearance-none"
                                            >
                                                {schools.map(s => (
                                                    <option key={s.school_id} value={s.school_id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Jenis Intervensi Dasar</label>
                                            <select
                                                value={simType}
                                                onChange={e => setSimType(e.target.value)}
                                                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-700 px-3.5 py-2.5 rounded-xl transition-all duration-200 outline-none text-[13px] shadow-sm appearance-none"
                                            >
                                                <option value="add_teachers">Penambahan Tenaga Pengajar (Guru)</option>
                                                <option value="increase_bos">Peningkatan Anggaran (BOS %)</option>
                                                <option value="infrastructure_investment">Renovasi Infrastruktur (Rupiah)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[12px] font-semibold text-slate-700 mb-1.5">Besaran (Magnitude)</label>
                                            <input
                                                type="number"
                                                value={simMag}
                                                onChange={e => setSimMag(parseFloat(e.target.value))}
                                                className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-slate-700 px-3.5 py-2.5 rounded-xl transition-all duration-200 outline-none text-[13px] shadow-sm"
                                                required
                                            />
                                            <span className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                                                <Icon icon="solar:info-circle-bold-duotone" className="w-3.5 h-3.5 text-slate-300" />
                                                Input dalam satuan absolut atau persentase.
                                            </span>
                                        </div>

                                        <div className="pt-2">
                                            <button
                                                type="submit"
                                                disabled={simulating}
                                                className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-[14px] flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {simulating ? (
                                                    <span className="flex items-center gap-2">
                                                        <Icon icon="solar:restart-bold-duotone" className="w-[18px] h-[18px] animate-spin" />
                                                        Memproses...
                                                    </span>
                                                ) : (
                                                    <span>Proyeksikan Dampak</span>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>

                            <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-2xl p-1.5 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] flex flex-col h-full">
                                <div className="p-5 border-b border-slate-100/80 bg-slate-50/50 rounded-t-xl flex items-center gap-2">
                                    <Icon icon="solar:graph-up-bold-duotone" className="w-[18px] h-[18px] text-indigo-500" />
                                    <h3 className="text-[14px] font-bold text-slate-800">Hasil Analisis Real-time</h3>
                                </div>
                                <div className="flex-1 p-6 md:p-8 flex flex-col justify-center relative overflow-hidden">
                                    {!simResult && (
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-bl-full -z-10" />
                                    )}
                                    
                                    {simResult ? (
                                        <div className="space-y-8 animate-fadein">
                                            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                                                <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl flex-1 relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/60 rounded-bl-full transition-transform group-hover:scale-110" />
                                                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-2">
                                                        <Icon icon="solar:history-bold-duotone" className="w-[16px] h-[16px] text-slate-400" /> Skor Awal
                                                    </span>
                                                    <div className="text-4xl font-bold text-slate-700 tracking-tight">{simResult.originalComposite.toFixed(1)}</div>
                                                </div>

                                                <div className="flex items-center justify-center shrink-0">
                                                    <div className="w-10 h-10 bg-slate-100/50 border border-slate-200/50 rounded-full hidden sm:flex items-center justify-center shadow-inner">
                                                        <Icon icon="solar:alt-arrow-right-linear" className="w-[20px] h-[20px] text-slate-400" />
                                                    </div>
                                                </div>

                                                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100/60 p-5 rounded-2xl flex-1 relative overflow-hidden group shadow-[inset_0_1px_4px_rgba(255,255,255,0.6)]">
                                                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 rounded-bl-full transition-transform group-hover:scale-110" />
                                                    <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1.5 mb-2">
                                                        <Icon icon="solar:target-bold-duotone" className="w-[16px] h-[16px]" /> Proyeksi Masa Depan
                                                    </span>
                                                    <div className="text-4xl font-bold text-indigo-700 tracking-tight flex items-baseline gap-1">
                                                        {simResult.projectedCompositeMin.toFixed(1)} <span className="text-lg font-medium text-indigo-400">s/d</span> {simResult.projectedCompositeMax.toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white border border-slate-200/70 p-5 rounded-2xl shadow-sm space-y-4">
                                                <div className="flex gap-4">
                                                    <div className="w-10 h-10 bg-blue-50 rounded-xl shrink-0 flex items-center justify-center mt-1">
                                                        <Icon icon="solar:document-text-bold-duotone" className="w-[20px] h-[20px] text-blue-500" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[12px] font-bold text-slate-700 block mb-1">Dasar Koefisien Marginal</span>
                                                        <p className="text-[12px] text-slate-500 leading-relaxed">{simResult.coefficientBasis}</p>
                                                    </div>
                                                </div>
                                                <div className="h-px w-full bg-slate-100" />
                                                <div className="flex gap-4">
                                                    <div className="w-10 h-10 bg-amber-50 rounded-xl shrink-0 flex items-center justify-center mt-1">
                                                        <Icon icon="solar:lightbulb-minimalistic-bold-duotone" className="w-[20px] h-[20px] text-amber-500" />
                                                    </div>
                                                    <div>
                                                        <span className="text-[12px] font-bold text-slate-700 block mb-1">Asumsi Model Dampak</span>
                                                        <p className="text-[12px] text-slate-500 leading-relaxed">{simResult.assumption}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-center opacity-80 py-10">
                                            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                                                <Icon icon="solar:chart-line-up-bold-duotone" className="w-[32px] h-[32px] text-slate-300" />
                                            </div>
                                            <p className="text-[14px] font-semibold text-slate-600">Belum Ada Proyeksi Aktif</p>
                                            <p className="text-[12px] text-slate-400 mt-1 max-w-[250px]">Atur konfigurasi intervensi di panel sebelah kiri untuk melihat estimasi dampak.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'recommendations' && (
                    <div className="space-y-8 animate-fadein">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                    <div className="p-1.5 bg-rose-50/80 rounded-lg">
                                        <Icon icon="solar:danger-triangle-bold-duotone" className="w-[22px] h-[22px] text-rose-600" />
                                    </div>
                                    Rekomendasi & Alerts
                                </h2>
                                <p className="text-[13px] text-slate-500 mt-1.5 ml-11">Ranking prioritas intervensi dinas hasil perhitungan Multi-Criteria Decision Analysis.</p>
                            </div>
                            <a
                                href="http://localhost:8000/api/v1/recommendations/export?period=2026-07"
                                download
                                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 text-[13px] shadow-sm flex items-center gap-2 max-w-fit"
                            >
                                <Icon icon="solar:download-square-bold-duotone" className="w-[18px] h-[18px]" /> Unduh CSV
                            </a>
                        </div>

                        {/* Recommendations Table */}
                        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] overflow-hidden">
                            <div className="p-5 border-b border-slate-100/80 bg-slate-50/50 flex items-center gap-2">
                                <Icon icon="solar:checklist-minimalistic-bold-duotone" className="w-[18px] h-[18px] text-slate-500" />
                                <h3 className="text-[14px] font-bold text-slate-800">Daftar Rekomendasi Prioritas</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-[13px] border-collapse">
                                    <thead>
                                        <tr className="bg-white border-b border-slate-100 text-slate-500 font-semibold text-[12px]">
                                            <th className="p-4 w-12 text-center">Rank</th>
                                            <th className="p-4">Nama Sekolah</th>
                                            <th className="p-4">Distrik</th>
                                            <th className="p-4 w-28 text-center">Health Score</th>
                                            <th className="p-4">Intervensi</th>
                                            <th className="p-4">Alasan (Rationale)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {recs.map(r => {
                                            const compScore = r.score_components?.compositeScore !== undefined 
                                                ? Number(r.score_components.compositeScore) 
                                                : 0;
                                            const intervention = r.score_components?.recommendedIntervention || 'N/A';
                                            
                                            return (
                                                <tr key={r.recommendation_id} className="hover:bg-slate-50/50 transition-colors duration-150">
                                                    <td className="p-4 text-center">
                                                        <span className="inline-flex items-center justify-center w-7 h-7 bg-blue-50 text-blue-600 font-bold rounded-full text-[12px] ring-1 ring-blue-100">{r.rank}</span>
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-800">{r.school_name}</td>
                                                    <td className="p-4 text-slate-500 text-[12px] font-medium">{r.district}</td>
                                                    <td className="p-4 text-center">
                                                        <span className={`font-bold text-[14px] ${compScore < 60 ? 'text-rose-500' : compScore < 80 ? 'text-amber-500' : 'text-emerald-600'}`}>{compScore.toFixed(0)}</span>
                                                        <span className="text-slate-400 text-[10px] ml-0.5">/100</span>
                                                    </td>
                                                    <td className="p-4 font-semibold text-slate-700">{intervention}</td>
                                                    <td className="p-4 text-slate-500 max-w-xs leading-relaxed text-[12px]">{r.rationale}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Alerts Management Section */}
                        <div className="space-y-5 pt-4">
                            <h3 className="text-[16px] font-bold text-slate-800 flex items-center gap-2">
                                <Icon icon="solar:bell-bing-bold-duotone" className="w-[20px] h-[20px] text-amber-500" />
                                Peringatan Dini & Kunjungan Lapangan
                            </h3>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white border border-slate-200/60 rounded-2xl shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
                                    <div className="p-5 border-b border-slate-100/80 bg-slate-50/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon icon="solar:siren-bold-duotone" className="w-[18px] h-[18px] text-slate-500" />
                                            <span className="text-[14px] font-bold text-slate-800">Daftar Alert Aktif</span>
                                        </div>
                                        <span className="bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-md text-[11px] font-bold">{alerts.length} Total</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {alerts.length > 0 ? alerts.map(a => (
                                            <div key={a.alert_id} className="p-5 flex justify-between items-center hover:bg-slate-50/50 transition-colors duration-150">
                                                <div className="space-y-1.5">
                                                    <span className="font-bold text-[13px] text-slate-800 block">{a.school_name || 'SDN Target'}</span>
                                                    <div className="flex gap-2 items-center text-[11px] text-slate-500 font-medium">
                                                        <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${a.severity === 'Critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            <Icon icon={a.severity === 'Critical' ? "solar:danger-circle-bold" : "solar:warning-circle-bold"} className="w-3 h-3" />
                                                            {a.severity}
                                                        </span>
                                                        <span>&middot;</span>
                                                        <span>{new Date(a.opened_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 items-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${a.status === 'Closed' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50' : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/50'}`}>
                                                        {a.status === 'Closed' ? 'Selesai' : 'Aktif'}
                                                    </span>
                                                    {a.status === 'Open' && (userRole === 'Admin' || userRole === 'Supervisor') && (
                                                        <button
                                                            onClick={() => setResolvingAlertId(a.alert_id)}
                                                            className="bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 px-3 py-1.5 rounded-lg transition-all duration-200 text-[12px] font-semibold shadow-sm"
                                                        >
                                                            Tindak Lanjut
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="p-8 text-center text-slate-400 text-[13px]">
                                                Tidak ada alert saat ini.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white border border-slate-200/60 rounded-2xl shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] p-1.5 flex flex-col">
                                    <div className="p-5 border-b border-slate-100/80 bg-slate-50/50 rounded-t-xl flex items-center gap-2">
                                        <Icon icon="solar:document-add-bold-duotone" className="w-[18px] h-[18px] text-slate-500" />
                                        <h3 className="text-[14px] font-bold text-slate-800">Resolusi Peringatan</h3>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        {!(userRole === 'Admin' || userRole === 'Supervisor') ? (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
                                                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
                                                    <Icon icon="solar:lock-keyhole-minimalistic-bold-duotone" className="w-[24px] h-[24px] text-slate-300" />
                                                </div>
                                                <p className="text-[13px] text-slate-600 font-bold">Akses Terbatas</p>
                                                <p className="text-[11px] text-slate-400 max-w-[180px] leading-relaxed">Hanya Pengawas Lapangan dan Admin yang dapat mencatat tindak lanjut.</p>
                                            </div>
                                        ) : resolvingAlertId ? (
                                            <form onSubmit={handleResolveAlert} className="space-y-4 flex-1 flex flex-col">
                                                <div className="flex-1">
                                                    <label className="block text-[12px] font-semibold text-slate-700 mb-2">Catatan Kunjungan Pengawas</label>
                                                    <textarea
                                                        placeholder="Tuliskan hasil penyidikan atau pembinaan di lapangan..."
                                                        value={visitNote}
                                                        onChange={e => setVisitNote(e.target.value)}
                                                        rows={5}
                                                        className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 text-slate-800 p-3.5 rounded-xl transition-all duration-200 outline-none text-[13px] resize-none"
                                                        required
                                                    />
                                                </div>
                                                <button
                                                    type="submit"
                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-[13px] shadow-sm flex items-center justify-center gap-2 mt-auto"
                                                >
                                                    <Icon icon="solar:diskette-bold-duotone" className="w-[18px] h-[18px]" />
                                                    Simpan & Tutup Alert
                                                </button>
                                            </form>
                                        ) : (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
                                                <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center">
                                                    <Icon icon="solar:shield-warning-bold-duotone" className="w-[24px] h-[24px] text-slate-300" />
                                                </div>
                                                <p className="text-[13px] text-slate-600 font-bold">Pilih Alert Aktif</p>
                                                <p className="text-[11px] text-slate-400 max-w-[180px] leading-relaxed">Klik tombol "Tindak Lanjut" pada tabel alert untuk mencatat resolusi.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'complaints' && (
                    <div className="space-y-8 animate-fadein">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-50/80 rounded-lg">
                                        <Icon icon="solar:chat-round-unread-bold-duotone" className="w-[22px] h-[22px] text-blue-600" />
                                    </div>
                                    Pengaduan AI (Inbound Review)
                                </h2>
                                <p className="text-[13px] text-slate-500 mt-1.5 ml-11">Laporan orang tua yang dianalisis oleh AI untuk klasifikasi sentimen dan penyusunan draf tanggapan otomatis.</p>
                            </div>
                            {userRole === 'Admin' && (
                                <button
                                    onClick={handleTriggerTraining}
                                    disabled={training}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 text-[13px] shadow-sm flex items-center gap-2 max-w-fit"
                                >
                                    <Icon icon="solar:cpu-bolt-bold-duotone" className={`w-[18px] h-[18px] ${training ? 'animate-spin' : ''}`} />
                                    {training ? 'Melatih AI...' : 'Latih Ulang AI Klasifikasi'}
                                </button>
                            )}
                        </div>

                        {trainingLogs && (
                            <div className="bg-slate-900 border border-slate-700 p-5 rounded-2xl shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon icon="solar:terminal-outline" className="w-[18px] h-[18px] text-slate-400" />
                                    <span className="block text-[12px] font-semibold text-slate-300">Log Retraining & Hot-Reload</span>
                                </div>
                                <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed custom-scrollbar bg-slate-950 p-4 rounded-xl border border-slate-800/50">{trainingLogs}</pre>
                            </div>
                        )}

                        {/* Complaints Card List */}
                        {complaints.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {complaints.map(c => (
                                    <div key={c.complaint_id} className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)] hover:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.08)] transition-all duration-300 flex flex-col justify-between space-y-5 group">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Icon icon="solar:tag-horizontal-bold-duotone" className="w-[16px] h-[16px] text-indigo-400" />
                                                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-md ring-1 ring-indigo-100">{c.category}</span>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${c.urgency === 'Critical' ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/60'}`}>
                                                    <Icon icon={c.urgency === 'Critical' ? 'solar:danger-circle-bold' : 'solar:info-circle-bold'} className="w-[14px] h-[14px]" />
                                                    {c.urgency}
                                                </span>
                                            </div>
                                            
                                            <div className="relative">
                                                <Icon icon="solar:quote-left-bold-duotone" className="w-8 h-8 text-slate-100 absolute -top-2 -left-2 -z-10" />
                                                <p className="text-[13px] text-slate-700 leading-relaxed font-medium z-10 relative">{c.text}</p>
                                            </div>

                                            {c.explanation && (
                                                <div className="bg-indigo-50/50 border-l-[3px] border-indigo-400 p-3.5 rounded-r-xl mt-2">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <Icon icon="solar:magic-stick-3-bold-duotone" className="w-[14px] h-[14px] text-indigo-500" />
                                                        <strong className="text-[11px] text-indigo-700 font-bold">Analisis Sentimen AI</strong>
                                                    </div>
                                                    <p className="text-[12px] text-slate-600 leading-relaxed">{c.explanation}</p>
                                                </div>
                                            )}

                                            {c.suggested_response && (
                                                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl mt-2 space-y-2 relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                                        <Icon icon="solar:pen-new-square-bold-duotone" className="w-16 h-16 text-white" />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 relative z-10">
                                                        <Icon icon="solar:letter-bold-duotone" className="w-[14px] h-[14px] text-slate-300" />
                                                        <strong className="text-[11px] text-slate-300 font-semibold tracking-wide">Draf Tanggapan Empati</strong>
                                                    </div>
                                                    <p className="whitespace-pre-wrap text-[12px] text-slate-400 font-mono leading-relaxed relative z-10">{c.suggested_response}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-slate-100/80 flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] text-slate-400 font-medium">Sentimen:</span>
                                                <strong className="text-[12px] text-slate-700">{c.sentiment}</strong>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${c.status === 'Resolved' ? 'bg-emerald-50 text-emerald-600' : c.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {c.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white border border-slate-200/60 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-[0_2px_20px_-4px_rgba(15,23,42,0.04)]">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                                    <Icon icon="solar:box-minimalistic-bold-duotone" className="w-[32px] h-[32px] text-slate-300" />
                                </div>
                                <h3 className="text-[15px] font-bold text-slate-700">Tidak ada pengaduan</h3>
                                <p className="text-[13px] text-slate-500 mt-1 max-w-sm">Kotak masuk pengaduan orang tua saat ini kosong.</p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
