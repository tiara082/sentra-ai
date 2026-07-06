import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ParentPortal from './pages/ParentPortal';
import DinasDashboard from './pages/DinasDashboard';

function App() {
  return (
    <BrowserRouter>
      {/* Dev Demo Navigation Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-3 flex justify-between items-center text-xs font-semibold text-gray-500">
        <span className="text-gray-900 font-bold">Sentra AI - EduPolicy Platform Demo</span>
        <div className="flex gap-6">
          <Link to="/" className="hover:text-blue-600 transition duration-150">Portal Orang Tua (PWA)</Link>
          <span className="text-gray-300">|</span>
          <Link to="/dinas" className="hover:text-blue-600 transition duration-150">Dashboard Dinas (Analis)</Link>
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
