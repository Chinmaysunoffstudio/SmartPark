/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';

function AppContent() {
  const { user, profile, loading, isAdmin } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center">
        <div className="relative flex flex-col items-center gap-6">
          <div className="relative w-12 h-12">
            <div className="absolute w-full h-full border-4 border-blue-600 rounded-full animate-ping opacity-20"></div>
            <div className="w-full h-full border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest animate-pulse">Syncing Encrypted Identity...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but profile is missing, we try to wait or show auth
  if (!user || !profile) {
    if (showAuth || user) {
      return <AuthPage onBack={() => setShowAuth(false)} />;
    }
    return <LandingPage onGoToAuth={() => setShowAuth(true)} />;
  }

  return (
    <div className="min-h-screen bg-surface-bg text-surface-text">
      {isAdmin && <Navbar />}
      {isAdmin ? <AdminDashboard /> : <UserDashboard />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
