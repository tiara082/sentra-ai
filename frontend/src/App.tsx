import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ParentPortal from './pages/ParentPortal';
import DinasDashboard from './pages/DinasDashboard';
import logoSentraAI from './assets/SENTRAI.png';

function App() {
  return (
    <BrowserRouter>
      {/* Dev Demo Navigation Bar */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-8 py-3 flex justify-between items-center text-xs shadow-[0_1px_3px_rgba(0,0,0,0.06)] sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <img src={logoSentraAI} alt="SENTRA-AI Logo" className="h-6 w-auto" />
          <div className="flex flex-col">
            <span className="text-slate-900 font-semibold tracking-tight text-xs">Sentra AI</span>
            <span className="text-slate-400 font-medium text-[10px] tracking-wide">EduPolicy Platform · Demo</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/" className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 font-medium px-3 py-1.5 rounded-lg transition-all duration-150">Portal Orang Tua</Link>
          <span className="text-slate-300 text-[10px]">·</span>
          <Link to="/dinas" className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 font-medium px-3 py-1.5 rounded-lg transition-all duration-150">Dashboard Dinas</Link>
        </div>
      </div>

      <Routes>
        <Route path="/" element={<ParentPortal />} />
        <Route path="/dinas" element={<DinasDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
