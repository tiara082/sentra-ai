import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Shield, BarChart3, MessageCircle,
  Users, School, TrendingUp, Cpu, ChevronRight,
  Lock, Menu, X, ExternalLink, CircleCheck,
  AlertTriangle, Eye, FileBarChart, Sparkles, Check, Copy,
  MapPin, Send, HelpCircle
} from 'lucide-react';
import logoSentraAI from '../assets/SENTRAI.png';

function useReveal(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Interactive Hero Dashboard State
  const [selectedSchool, setSelectedSchool] = useState<string>('SDN Turen 3');
  const [simBudget, setSimBudget] = useState<number>(180);

  // Interactive AI Sandbox State
  const [complaintText, setComplaintText] = useState('Toilet sekolah kotor dan atap kelas bocor sehingga mengganggu belajar.');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{
    category: string;
    sentiment: 'Negatif' | 'Positif' | 'Netral';
    urgency: 'Tinggi' | 'Sedang' | 'Rendah';
    score: number;
    draft: string;
  } | null>({
    category: 'Fasilitas & Sanitasi',
    sentiment: 'Negatif',
    urgency: 'Tinggi',
    score: 88,
    draft: 'Yth. Pelapor, laporan mengenai kerusakan atap dan kondisi sanitasi di SDN Turen 3 telah kami terima. Tim sarana prasarana akan segera melakukan verifikasi lapangan.'
  });

  const schoolsData: Record<string, { score: number; alerts: string; teacher: string; cleanliness: string }> = {
    'SDN Turen 3': { score: 48, alerts: 'Diskrepansi data guru', teacher: 'Sering absen (Survei)', cleanliness: 'Kurang Layak (Survei)' },
    'SDN Pakis 1': { score: 62, alerts: 'Kontradiksi sanitasi', teacher: 'Hadir Penuh (Dapodik)', cleanliness: 'Buruk (Survei)' },
    'SDN Bululawang 2': { score: 79, alerts: 'Indikasi pungutan liar', teacher: 'Hadir Penuh (Dapodik)', cleanliness: 'Layak (Dapodik)' },
    'SDN Kepanjen 1': { score: 91, alerts: 'Kondisi Normal', teacher: 'Hadir Penuh (Dapodik)', cleanliness: 'Sangat Baik (Dapodik)' },
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(`// enkripsi at-rest per-baris
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
let encrypted = cipher.update(complaintText, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulate AI Processing
  const handleAiAnalyze = () => {
    if (!complaintText.trim()) return;
    setAiAnalyzing(true);
    setAiResult(null);
    setTimeout(() => {
      const text = complaintText.toLowerCase();
      let category = 'Lainnya';
      let urgency: 'Tinggi' | 'Sedang' | 'Rendah' = 'Sedang';
      let score = 55;
      let draft = 'Laporan Anda telah diterima dan akan diteruskan ke bidang terkait.';

      if (text.includes('pungli') || text.includes('denda') || text.includes('bayar') || text.includes('uang')) {
        category = 'Transparansi Biaya / Pungli';
        urgency = 'Tinggi';
        score = 95;
        draft = 'Terima kasih atas laporan Anda. Laporan mengenai pungutan tidak resmi akan kami tindak lanjuti secara rahasia melalui tim inspektorat dinas.';
      } else if (text.includes('toilet') || text.includes('bocor') || text.includes('atap') || text.includes('kursi') || text.includes('rusak')) {
        category = 'Fasilitas & Sanitasi';
        urgency = 'Tinggi';
        score = 85;
        draft = 'Laporan sarana prasarana sekolah terdeteksi. Kami segera mengagendakan survei fisik guna perbaikan sarana belajar mengajar.';
      } else if (text.includes('pukul') || text.includes('bully') || text.includes('ejek') || text.includes('tengkar')) {
        category = 'Keamanan / Perundungan';
        urgency = 'Tinggi';
        score = 92;
        draft = 'Laporan perundungan/bullying mendapat perhatian utama. Kami akan berkoordinasi dengan kepala sekolah dan unit konseling sekolah.';
      } else if (text.includes('absen') || text.includes('bolos') || text.includes('guru')) {
        category = 'Kehadiran Guru';
        urgency = 'Sedang';
        score = 65;
        draft = 'Laporan kedisiplinan pengajar telah diterima. Evaluasi presensi berkala akan dicocokkan dengan data presensi digital dinas.';
      }

      setAiResult({
        category,
        sentiment: 'Negatif',
        urgency,
        score,
        draft: `Yth. Pelapor, ${draft}`
      });
      setAiAnalyzing(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans selection:bg-blue-600/20 selection:text-blue-700">
      
      {/* ─── Premium Grid Background Pattern with Spotlight Gradient ─── */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none opacity-50" />
      
      {/* ─── Hero Spotlight Glow (Super Eye-Catching) ─── */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gradient-to-tr from-blue-300/30 to-indigo-400/20 rounded-full blur-[130px] pointer-events-none transform -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-[30vh] right-10 w-[450px] h-[450px] bg-gradient-to-bl from-purple-200/20 to-blue-300/20 rounded-full blur-[110px] pointer-events-none" />

      {/* ═══════════════════════ NAVIGATION ═══════════════════════ */}
      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'bg-white/80 backdrop-blur-md shadow-[0_2px_15px_rgba(15,23,42,0.04)] border-b border-slate-200/40 py-3.5' 
          : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-8">
          <Link to="/" className="shrink-0 transition-transform active:scale-95">
            <img src={logoSentraAI} alt="Sentra AI" className="h-6.5 w-auto" />
          </Link>

          <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-slate-500">
            <a href="#fitur" className="hover:text-blue-600 transition-colors">Fitur Utama</a>
            <a href="#alur" className="hover:text-blue-600 transition-colors">Alur Kerja</a>
            <a href="#keamanan" className="hover:text-blue-600 transition-colors">Keamanan</a>
            <a href="#sandbox" className="hover:text-blue-600 transition-colors">AI Sandbox</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/parent" className="text-[13px] font-semibold text-slate-600 hover:text-blue-600 px-3 py-2 transition-colors">
              Portal Orang Tua
            </Link>
            <Link to="/dinas" className="text-[13px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-3 rounded-xl transition-all duration-200 shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 flex items-center gap-1.5">
              Dashboard Dinas <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <button 
            onClick={() => setMenuOpen(!menuOpen)} 
            className="md:hidden p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors" 
            aria-label="Toggle Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-200 px-6 py-6 space-y-2 shadow-2xl animate-fadein">
            <a href="#fitur" onClick={() => setMenuOpen(false)} className="block py-3 px-4 text-sm font-semibold text-slate-600 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-all">Fitur Utama</a>
            <a href="#alur" onClick={() => setMenuOpen(false)} className="block py-3 px-4 text-sm font-semibold text-slate-600 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-all">Alur Kerja</a>
            <a href="#keamanan" onClick={() => setMenuOpen(false)} className="block py-3 px-4 text-sm font-semibold text-slate-600 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-all">Keamanan</a>
            <a href="#sandbox" onClick={() => setMenuOpen(false)} className="block py-3 px-4 text-sm font-semibold text-slate-600 hover:text-blue-600 rounded-xl hover:bg-slate-50 transition-all">AI Sandbox</a>
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <Link to="/parent" className="block text-center text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl py-3 hover:bg-slate-50 transition-all">Portal Orang Tua</Link>
              <Link to="/dinas" className="block text-center text-sm font-semibold text-white bg-blue-600 rounded-xl py-3 shadow-md shadow-blue-500/10 hover:bg-blue-700 transition-all">Akses Dashboard Dinas</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════ HERO SECTION ═══════════════════════ */}
      <section className="relative pt-36 pb-28 lg:pt-48 lg:pb-40 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Hero Text */}
          <div className="lg:col-span-5 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50/80 border border-blue-200/50 mb-6 backdrop-blur-sm animate-fadein">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-blue-800 text-[11px] font-bold tracking-wider uppercase">KMIPN VIII · Kategori Smart City & Decision Support</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[4rem] font-black leading-[1.05] tracking-tight text-slate-900 mb-6 animate-fadein">
              Transparansi data
              <br />
              pendidikan daerah.
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">Kebijakan berbasis bukti.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-10 animate-fadein">
              Sentra AI merupakan platform <span className="text-slate-900 font-semibold">decision intelligence</span> yang memfusikan data indikator Dapodik dengan survei real-time orang tua (<span className="text-slate-900 font-semibold">ParentPulse</span>) untuk melacak kondisi kesehatan sekolah secara objektif.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 animate-fadein">
              <Link to="/dinas" className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-8 py-4.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:-translate-y-0.5 active:translate-y-0">
                Akses Dashboard Dinas
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/parent" className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold px-8 py-4.5 rounded-xl transition-all shadow-sm hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0">
                Akses Portal Orang Tua
              </Link>
            </div>
          </div>

          {/* Interactive Playable Dashboard Mockup (Super Eye-Catching) */}
          <div className="lg:col-span-7 relative">
            {/* Ambient Background Glow matching the selected score */}
            <div className={`absolute inset-0 rounded-[2rem] blur-[60px] -z-10 transform scale-95 opacity-20 transition-colors duration-500 ${
              schoolsData[selectedSchool].score >= 80 ? 'bg-emerald-500' : schoolsData[selectedSchool].score >= 60 ? 'bg-blue-500' : 'bg-red-500'
            }`} />

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_30px_60px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.02)] overflow-hidden transition-all duration-300 hover:shadow-[0_40px_80px_rgba(15,23,42,0.16)]">
              {/* Browser Window Header */}
              <div className="flex items-center justify-between px-4 py-3.5 bg-slate-50 border-b border-slate-200/60">
                <div className="flex gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-400/90" />
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-400/90" />
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400/90" />
                </div>
                <div className="bg-white border border-slate-200/60 rounded-lg px-4 py-1 text-[10px] text-slate-400 font-semibold tracking-wider w-64 text-center truncate shadow-sm">
                  sentra-ai.dinas.go.id/sekolah/{selectedSchool.toLowerCase().replace(/\s/g, '-')}
                </div>
                <div className="w-10 flex justify-end">
                  <HelpCircle className="w-4 h-4 text-slate-300 hover:text-slate-400 cursor-help" />
                </div>
              </div>

              {/* Dashboard Playground Body */}
              <div className="p-5 sm:p-6 bg-slate-50/30">
                
                {/* School Selector Interactive Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-4 mb-4 border-b border-slate-200/50 scrollbar-none">
                  {Object.keys(schoolsData).map(school => (
                    <button
                      key={school}
                      onClick={() => setSelectedSchool(school)}
                      className={`text-[11px] font-bold px-3.5 py-2 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                        selectedSchool === school
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                          : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 shadow-sm'
                      }`}
                    >
                      <School className="w-3 h-3" />
                      {school}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left Column: Health Score Card (Highly Dynamic) */}
                  <div className="bg-white rounded-xl border border-slate-200/60 p-5 shadow-sm flex flex-col justify-between items-center text-center">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Skor Kesehatan</span>
                    
                    <div className="relative my-4 flex items-center justify-center">
                      {/* Circular Gauge Border */}
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                        <circle 
                          cx="48" 
                          cy="48" 
                          r="40" 
                          stroke={schoolsData[selectedSchool].score >= 80 ? '#10b981' : schoolsData[selectedSchool].score >= 60 ? '#2563eb' : '#ef4444'} 
                          strokeWidth="8" 
                          fill="transparent" 
                          strokeDasharray="251.2"
                          strokeDashoffset={251.2 - (251.2 * schoolsData[selectedSchool].score) / 100}
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-2xl font-black text-slate-800 leading-none">{schoolsData[selectedSchool].score}</span>
                        <span className="text-[10px] text-slate-400 block font-bold">/100</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded ${
                      schoolsData[selectedSchool].score >= 80 ? 'bg-emerald-50 text-emerald-700' : schoolsData[selectedSchool].score >= 60 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {schoolsData[selectedSchool].score >= 80 ? 'Predikat Unggul' : schoolsData[selectedSchool].score >= 60 ? 'Predikat Standar' : 'Butuh Intervensi'}
                    </span>
                  </div>

                  {/* Right Column: Comparative Metrics */}
                  <div className="md:col-span-2 flex flex-col justify-between gap-3">
                    {/* Status Data */}
                    <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Deteksi Ground Truth Flags</span>
                      <div className="flex gap-3 items-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          schoolsData[selectedSchool].score >= 80 ? 'bg-emerald-50' : schoolsData[selectedSchool].score >= 60 ? 'bg-amber-50' : 'bg-red-50'
                        }`}>
                          <AlertTriangle className={`w-4 h-4 ${
                            schoolsData[selectedSchool].score >= 80 ? 'text-emerald-500' : schoolsData[selectedSchool].score >= 60 ? 'text-amber-500' : 'text-red-500'
                          }`} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{schoolsData[selectedSchool].alerts}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Analisis kontradiksi survei vs data resmi</span>
                        </div>
                      </div>
                    </div>

                    {/* Compare Indicators */}
                    <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm space-y-3">
                      <div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                          <span>Ketersediaan Tenaga Pengajar</span>
                          <span className="text-slate-800">{schoolsData[selectedSchool].teacher}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${
                            schoolsData[selectedSchool].score >= 80 ? 'w-full bg-emerald-500' : 'w-2/3 bg-blue-500'
                          }`} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                          <span>Kondisi Kebersihan Toilet</span>
                          <span className="text-slate-800">{schoolsData[selectedSchool].cleanliness}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${
                            schoolsData[selectedSchool].score >= 80 ? 'w-11/12 bg-emerald-500' : schoolsData[selectedSchool].score >= 60 ? 'w-8/12 bg-blue-500' : 'w-4/12 bg-red-500'
                          }`} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ═══════════════════════ SOCIAL PROOF / STATS STRIP ═══════════════════════ */}
      <NumberStrip />

      {/* ═══════════════════════ FITUR UTAMA (BENTO GRID) ═══════════════════════ */}
      <section id="fitur" className="py-24 lg:py-32 px-6 lg:px-8 bg-slate-50/50 border-y border-slate-200/40 relative">
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-[11px] font-bold text-blue-600 tracking-widest uppercase bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200/30">Kerangka Kerja Sentra AI</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-6 mb-4">
                Fusi Data & Decision Intelligence Terintegrasi
              </h2>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                Platform dirancang secara asimetris untuk mempermudah analisis dinas pendidikan kabupaten/kota dari tingkat makro hingga mikro.
              </p>
            </div>
          </RevealBlock>

          {/* Bento Grid layout */}
          <div className="grid md:grid-cols-6 gap-6">
            
            {/* Card 1: Skor Kesehatan */}
            <BentoCard className="md:col-span-4 p-8 flex flex-col justify-between" delay={0}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200/30 px-2.5 py-1 rounded-md">Modul Utama</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg mb-2">Skor Kesehatan & Peta Risiko Sekolah</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Menyajikan indeks komposit objektif yang dihitung dari 9 dimensi survei ParentPulse, kemudian difusikan dengan data Dapodik resmi.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                {[
                  { label: 'Kehadiran Guru', score: 85, color: 'bg-emerald-500' },
                  { label: 'Bebas Pungli', score: 72, color: 'bg-blue-600' },
                  { label: 'Keamanan Lingkungan', score: 45, color: 'bg-amber-500' },
                ].map(item => (
                  <div key={item.label} className="bg-white p-3 rounded-lg border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
                    <span className="text-[10px] text-slate-400 font-bold block mb-1">{item.label}</span>
                    <div className="flex items-center justify-between gap-4 mt-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${item.score}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap">{item.score}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>

            {/* Card 2: Ground Truth Flags */}
            <BentoCard className="md:col-span-2 p-8 flex flex-col justify-between animate-glow-subtle" delay={100}>
              <div>
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center border border-red-100 mb-6">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg mb-2">Ground Truth Flags</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Algoritma deteksi anomali untuk memetakan inkonsistensi antara laporan resmi sekolah dengan realita objektif survei masyarakat secara real-time.
                </p>
              </div>
              <div className="mt-4 bg-red-50/60 border border-red-100 rounded-xl p-3.5 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-[11px] font-bold text-red-700">Diskrepansi data Dapodik terdeteksi</span>
              </div>
            </BentoCard>

            {/* Card 3: Simulasi Kebijakan */}
            <BentoCard className="md:col-span-2 p-8 flex flex-col justify-between" delay={200}>
              <div>
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100 mb-6">
                  <Cpu className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg mb-2">Simulasi Kebijakan</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Simulator What-If interaktif untuk memproyeksikan perubahan skor kesehatan sekolah berdasarkan penyesuaian alokasi anggaran atau intervensi fasilitas.
                </p>
              </div>
              
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] text-slate-400 font-bold">Dana Stimulus Sanitasi</span>
                  <span className="text-xs font-bold text-blue-600">{simBudget} Juta</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="300" 
                  value={simBudget} 
                  onChange={(e) => setSimBudget(Number(e.target.value))}
                  className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-200/50">
                  <span className="text-[9px] text-slate-400 font-bold">Proyeksi Skor Sanitasi</span>
                  <span className="text-[10px] font-extrabold text-emerald-600">+{Math.round(simBudget * 0.12)}% Terangkat</span>
                </div>
              </div>
            </BentoCard>

            {/* Card 4: Portal Aduan & AI */}
            <BentoCard className="md:col-span-4 p-8 flex flex-col justify-between" delay={300}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                    <MessageCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/30 px-2.5 py-1 rounded-md">NLP Pipeline</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg mb-2">Portal Orang Tua & Klasifikasi AI</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  Orang tua dapat melaporkan kondisi riil melalui portal web mobile-first. AI berbasis sentence embeddings (Xenova/multilingual-e5-small) akan mengklasifikasikan kategori secara real-time.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                {[
                  { label: '1. Input Warga', desc: 'Aduan bebas/survei', active: true },
                  { label: '2. Sentimen AI', desc: 'Model NLP Xenova', active: true },
                  { label: '3. Auto-Categorize', desc: 'Klasifikasi urgensi', active: true },
                  { label: '4. Respon Empati', desc: 'Draf jawaban dinas', active: false },
                ].map((s, idx) => (
                  <div key={s.label} className={`flex-1 p-3 rounded-lg border ${
                    s.active 
                      ? 'bg-blue-50/50 border-blue-200 text-blue-800' 
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}>
                    <span className="text-[10px] font-bold block">{s.label}</span>
                    <span className="text-[9px] block mt-0.5 opacity-80">{s.desc}</span>
                  </div>
                ))}
              </div>
            </BentoCard>

          </div>
        </div>
      </section>

      {/* ═══════════════════════ INTERACTIVE AI SANDBOX PLAYGROUND (SHOW STOPPER / EYE CATCHING) ═══════════════════════ */}
      <section id="sandbox" className="py-24 lg:py-32 px-6 lg:px-8 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.05),transparent_40%)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-[11px] font-bold text-indigo-600 tracking-widest uppercase bg-indigo-50 px-3.5 py-1.5 rounded-full border border-indigo-200/30">Sandbox AI Interaktif</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-6 mb-4">
                Uji Coba Langsung Analisis Model NLP Sentra AI
              </h2>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                Ketik pengaduan sekolah acak di bawah ini untuk mensimulasikan bagaimana mesin AI kami memproses embedding teks dan mengklasifikasikan kategori.
              </p>
            </div>
          </RevealBlock>

          <div className="grid lg:grid-cols-12 gap-8 items-stretch max-w-5xl mx-auto">
            
            {/* Input Form Panel */}
            <div className="lg:col-span-6 bg-slate-50 border border-slate-200/70 p-6 rounded-2xl flex flex-col justify-between shadow-sm">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-3">Teks Pengaduan Masyarakat</span>
                <textarea
                  value={complaintText}
                  onChange={(e) => setComplaintText(e.target.value)}
                  placeholder="Ketik keluhan sekolah di sini..."
                  className="w-full h-36 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl p-4 text-sm font-medium resize-none shadow-sm focus:outline-none transition-all"
                />
                
                {/* Presets */}
                <div className="mt-4">
                  <span className="text-[10px] text-slate-400 font-bold block mb-2">Preset Aduan Terbanyak:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Sekolah mewajibkan beli LKS seharga 300 ribu rupiah',
                      'Guru kelas 5 sering terlambat mengajar hampir 1 jam',
                      'Ada ejekan fisik antar murid tetapi guru mendiamkannya',
                    ].map(p => (
                      <button
                        key={p}
                        onClick={() => setComplaintText(p)}
                        className="text-[10.5px] font-semibold text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 px-2.5 py-1.5 rounded-lg text-left truncate max-w-xs transition-colors"
                      >
                        "{p}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleAiAnalyze}
                disabled={aiAnalyzing || !complaintText.trim()}
                className="mt-6 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {aiAnalyzing ? (
                  <>
                    <Cpu className="w-4 h-4 animate-spin text-blue-400" />
                    Memproses Kalimat...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Analisis dengan Model NLP
                  </>
                )}
              </button>
            </div>

            {/* AI Results Visualization Panel */}
            <div className="lg:col-span-6 bg-slate-900 text-white p-6 rounded-2xl flex flex-col justify-between shadow-xl relative overflow-hidden group">
              {/* Highlight gradient */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hasil Ekstraksi Entitas AI</span>
                  <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                    e5-small model
                  </span>
                </div>

                {aiAnalyzing && (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <Cpu className="w-8 h-8 text-blue-400 animate-spin" />
                    <span className="text-xs font-semibold">Menghitung sentence embeddings...</span>
                  </div>
                )}

                {!aiAnalyzing && aiResult && (
                  <div className="space-y-5 mt-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Kategori Terdeteksi</span>
                        <span className="text-sm font-extrabold text-blue-300 flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          {aiResult.category}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">Skala Urgensi</span>
                        <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded inline-block ${
                          aiResult.urgency === 'Tinggi' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {aiResult.urgency}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">Sentence Vector Similarity</span>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${aiResult.score}%` }} />
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-300">{aiResult.score}%</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-1">Draf Balasan Empati (Generative Dinas)</span>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/80 border border-slate-800 rounded-xl p-3.5 font-medium">
                        "{aiResult.draft}"
                      </p>
                    </div>
                  </div>
                )}

                {!aiResult && !aiAnalyzing && (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-500 text-center px-6">
                    <HelpCircle className="w-8 h-8 mb-2" />
                    <span className="text-xs font-semibold">Tulis kalimat di panel kiri dan klik proses untuk memulai simulasi klasifikasi model NLP.</span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                <span>Output Formatted JSON</span>
                <span className="text-emerald-400 font-bold">READY</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════ ALUR KERJA SECTION ═══════════════════════ */}
      <section id="alur" className="py-24 lg:py-32 px-6 lg:px-8 bg-slate-50/50 border-y border-slate-200/40 relative">
        <div className="max-w-7xl mx-auto">
          <RevealBlock>
            <div className="text-center max-w-2xl mx-auto mb-20">
              <span className="text-[11px] font-bold text-blue-600 tracking-widest uppercase bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200/30">Tahapan Sistem</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-6 mb-4">
                Dari Data Mentah Menuju Rekomendasi Kebijakan
              </h2>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                Sentra AI memproses data secara bertahap melalui sistem otomatisasi untuk menghasilkan keputusan yang presisi bagi pemangku kebijakan.
              </p>
            </div>
          </RevealBlock>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { num: '01', title: 'Impor & Enkripsi', desc: 'Data sekolah, Dapodik, dan pengaduan orang tua diimpor secara periodik lalu diamankan menggunakan protokol kriptografi.', icon: Lock },
              { num: '02', title: 'Pemrosesan AI', desc: 'Text embedding dan analisis sentimen memilah aduan warga berdasarkan dimensi prioritas secara otomatis.', icon: Cpu },
              { num: '03', title: 'Skoring & Flagging', desc: 'Perhitungan skor kesehatan per sekolah dan pendeteksian diskrepansi data diaktifkan.', icon: BarChart3 },
              { num: '04', title: 'Rekomendasi Kebijakan', desc: 'Platform mengurutkan prioritas intervensi anggaran dan merekomendasikan opsi kebijakan terbaik.', icon: TrendingUp },
            ].map((step, i) => (
              <StepItem key={step.num} {...step} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ KEAMANAN SECTION ═══════════════════════ */}
      <section id="keamanan" className="py-24 lg:py-32 px-6 lg:px-8 bg-white relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            
            <RevealBlock>
              <span className="text-[11px] font-bold text-blue-600 tracking-widest uppercase bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-200/30">Privasi & Kriptografi</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-6 mb-6">
                Perlindungan Data Warga Sesuai Standar Industri
              </h2>
              <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-8">
                Privasi dan keamanan identitas pelapor dilindungi secara mutlak melalui metode enkripsi per-baris (row-level encryption). Data sensitif dienkripsi pada tingkat database.
              </p>

              <div className="space-y-4">
                {[
                  { text: 'Enkripsi AES-256-GCM pada seluruh data pengaduan dan nomor telepon.', icon: Lock },
                  { text: 'Jaminan anonimitas penuh — database tidak merekam relasi data pribadi pelapor.', icon: Users },
                  { text: 'Akses berbasis peran ketat (RBAC) untuk Dinas, Pengawas, dan Kepala Sekolah.', icon: Shield },
                  { text: 'Daftar log aktivitas tersertifikasi untuk audit transparansi keamanan.', icon: Eye },
                ].map(item => (
                  <div key={item.text} className="flex gap-4.5 items-start">
                    <div className="w-6.5 h-6.5 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0 border border-emerald-100">
                      <item.icon className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium text-slate-700 leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </RevealBlock>

            {/* Code Block / Terminal Visualization */}
            <RevealBlock delay={200}>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  </div>
                  <button 
                    onClick={handleCopyCode} 
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Salin Kode"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto">
                  <div className="text-slate-500 mb-2">// tabel complaints — PostgreSQL encryption logic</div>
                  <div><span className="text-slate-500">text_complaint:</span> <span className="text-blue-400">"a3f8d29b4c10ef8a...encrypted...9c4b1e"</span></div>
                  <div><span className="text-slate-500">phone_number:</span> <span className="text-blue-400">"7d2e91a0c84f2b9d...encrypted...3f8a0c"</span></div>
                  <div><span className="text-slate-500">initial_vector:</span> <span className="text-indigo-400">"b4c8f1a9e2fd..."</span></div>
                  <div><span className="text-slate-500">auth_tag:</span> <span className="text-indigo-400">"e7d3c2f01b7a..."</span></div>
                  
                  <div className="mt-4 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
                    <span className="text-emerald-500 font-bold">Status:</span> Kriptografi AES-256-GCM Aktif (Per-Row IV)
                  </div>
                </div>
              </div>
            </RevealBlock>

          </div>
        </div>
      </section>

      {/* ═══════════════════════ TESTIMONIAL / QUOTE SECTION ═══════════════════════ */}
      <section id="testimoni" className="py-24 lg:py-32 px-6 lg:px-8 bg-slate-50 border-t border-slate-200/40 relative">
        <div className="max-w-4xl mx-auto text-center">
          <RevealBlock>
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-blue-100/50">
              <span className="text-4xl text-blue-600 font-serif leading-none">“</span>
            </div>
            <blockquote className="text-xl sm:text-2xl text-slate-700 font-semibold leading-relaxed mb-8">
              "Sebelum menggunakan Sentra AI, proses kompilasi data dari 24 sekolah memerlukan waktu berminggu-minggu secara manual. Kini, seluruh skor kesehatan sekolah dapat diakses langsung melalui Peta Risiko. Fitur Ground Truth Flags sangat membantu kami mengidentifikasi diskrepansi data Dapodik secara cepat."
            </blockquote>
            <div className="inline-flex items-center gap-4 text-left">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-base shadow-lg shadow-blue-500/20">
                RS
              </div>
              <div>
                <span className="text-base font-bold text-slate-900 block">Rina Subekti, S.Pd.</span>
                <span className="text-xs text-slate-400 font-medium">Analis Kebijakan Dinas Pendidikan — Akun: bu_rina@edupolicy.go.id</span>
              </div>
            </div>
          </RevealBlock>
        </div>
      </section>

      {/* ═══════════════════════ CALL TO ACTION ═══════════════════════ */}
      <section className="py-24 lg:py-32 px-6 lg:px-8 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,#1e3a8a_0%,transparent_100%)] opacity-20 pointer-events-none" />
        
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6">
            Uji Coba Platform Sentra AI
          </h2>
          <p className="text-sm sm:text-base text-slate-400 mb-12 max-w-lg mx-auto leading-relaxed">
            Lingkungan simulasi demonstrasi telah terintegrasi dengan data 24 sekolah sampel di Jawa Timur untuk mendukung penilaian juri KMIPN VIII.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/dinas" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-8 py-4.5 rounded-xl transition-all shadow-lg shadow-blue-500/10">
              Masuk Dashboard Dinas
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/parent" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-slate-700 hover:border-slate-600 text-slate-200 text-sm font-semibold px-8 py-4.5 rounded-xl transition-all hover:bg-white/5">
              Portal Pengaduan Orang Tua
            </Link>
          </div>
          
          <p className="mt-8 text-xs text-slate-500 font-medium">
            Tersedia 3 Peran Akses Simulasi: Analis Dinas (Utama) · Pengawas Sekolah · Kepala Sekolah. Kredensial tersedia pada halaman masuk.
          </p>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer className="bg-slate-950 border-t border-slate-900 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-16">
          <div className="grid md:grid-cols-12 gap-12 mb-12">
            <div className="md:col-span-6">
              <img src={logoSentraAI} alt="Sentra AI" className="h-6.5 w-auto brightness-0 invert opacity-70 mb-4" />
              <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
                Platform decision support system berbasis kecerdasan buatan untuk audit transparansi dan standardisasi pelayanan sekolah di Indonesia.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-md text-[10px] text-slate-500 font-bold tracking-wider">
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                TRANSIT & AT-REST DATA SECURED
              </div>
            </div>
            
            <div className="md:col-span-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">Navigasi</span>
              <div className="space-y-3">
                <Link to="/dinas" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">Dashboard Dinas</Link>
                <Link to="/parent" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">Portal Orang Tua</Link>
                <a href="#fitur" className="block text-sm text-slate-500 hover:text-slate-300 transition-colors">Fitur Utama</a>
              </div>
            </div>

            <div className="md:col-span-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-4">Kemitraan</span>
              <div className="space-y-2 text-sm text-slate-500">
                <p className="font-semibold text-slate-400">Pendidikan Jatim</p>
                <p>sentra-ai@edupolicy.go.id</p>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs text-slate-600">© 2026 Sentra AI — Smart City & Decision Support System (KMIPN VIII)</span>
            <div className="flex gap-6 text-xs text-slate-600">
              <span className="hover:text-slate-400 cursor-pointer">Kebijakan Privasi</span>
              <span className="hover:text-slate-400 cursor-pointer">Syarat Ketentuan</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Helper Reveal Components ─── */
function RevealBlock({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function BentoCard({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(15,23,42,0.01),0_10px_20px_-5px_rgba(15,23,42,0.03)] hover:shadow-[0_15px_30px_rgba(15,23,42,0.06)] hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-300 ${className} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function NumberStrip() {
  const { ref, visible } = useReveal(0.2);
  return (
    <div ref={ref} className={`border-y border-slate-200/50 bg-white transition-all duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
        {[
          { val: '24', label: 'Sekolah Terpantau', sub: 'Jawa Timur' },
          { val: '9', label: 'Dimensi Evaluasi', sub: 'Metodologi ParentPulse' },
          { val: '3', label: 'Tingkat Akses Akun', sub: 'Dinas, Pengawas, Kepsek' },
          { val: 'AES-256', label: 'Protokol Kriptografi', sub: 'GCM Per-Row Enkripsi' },
        ].map(n => (
          <div key={n.label} className="text-center md:text-left">
            <span className="text-3xl font-black text-slate-900 block tracking-tight">{n.val}</span>
            <span className="text-sm text-slate-800 font-bold block mt-1">{n.label}</span>
            <span className="text-xs text-slate-400 font-medium block mt-0.5">{n.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepItem({ num, title, desc, icon: Icon, index }: { num: string; title: string; desc: string; icon: typeof Lock; index: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative py-4 md:py-0 transition-all duration-750 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      <div className="md:pr-8">
        <div className="flex items-center gap-3.5 mb-4">
          <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200/30 w-8 h-8 rounded-lg flex items-center justify-center">{num}</span>
          <Icon className="w-4 h-4 text-slate-400" />
        </div>
        <h3 className="font-extrabold text-slate-900 text-base mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
