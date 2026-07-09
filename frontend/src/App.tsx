import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import ParentPortal from './pages/ParentPortal';
import DinasDashboard from './pages/DinasDashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/parent" element={<ParentPortal />} />
        <Route path="/dinas" element={<DinasDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
