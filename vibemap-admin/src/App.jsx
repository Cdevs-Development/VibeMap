import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminAuthGuard from './components/auth/AdminAuthGuard';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LiveSosPage from './pages/LiveSosPage';
import SosHistoryPage from './pages/SosHistoryPage';
import UsersPage from './pages/UsersPage';
import PinsModerationPage from './pages/PinsModerationPage';
import BeneficiariesPage from './pages/BeneficiariesPage';
import TripsAnalyticsPage from './pages/TripsAnalyticsPage';
import SystemHealthPage from './pages/SystemHealthPage';
import BroadcastPage from './pages/BroadcastPage';
import AdminAccessPage from './pages/AdminAccessPage';
import LegalContentPage from './pages/LegalContentPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route element={<AdminAuthGuard><AdminLayout /></AdminAuthGuard>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sos" element={<LiveSosPage />} />
            <Route path="/sos/history" element={<SosHistoryPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/pins" element={<PinsModerationPage />} />
            <Route path="/beneficiaries" element={<BeneficiariesPage />} />
            <Route path="/trips" element={<TripsAnalyticsPage />} />
            <Route path="/system" element={<SystemHealthPage />} />
            <Route path="/broadcast" element={<BroadcastPage />} />
            <Route path="/access" element={<AdminAccessPage />} />
            <Route path="/legal" element={<LegalContentPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}


export default App;
