import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Car, User, LogOut, Map, LayoutDashboard, QrCode, Sun, Moon } from 'lucide-react';

export default function Navbar() {
  const { profile, isAdmin } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || document.body.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleSignOut = () => supabase.auth.signOut();

  if (!profile) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] bg-surface-bg/80 backdrop-blur-xl border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Car className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-display font-black text-surface-text tracking-wide uppercase">ParkPrecision <span className="text-blue-500 not-italic font-sans text-[10px] uppercase font-bold tracking-widest ml-2 px-1.5 py-0.5 bg-blue-500/10 rounded border border-blue-500/20">{isAdmin ? 'Admin Node' : 'User Node'}</span></h1>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 glass rounded-lg text-surface-muted hover:text-surface-text transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="hidden md:flex items-center gap-2 bg-surface-card border border-surface-border rounded-full px-4 py-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-[10px] font-mono text-surface-muted uppercase tracking-tighter">System Operational</span>
          </div>
          
          <div className="flex items-center gap-4 pl-6 border-l border-surface-border">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-surface-text">{profile.email.split('@')[0]}</p>
              <p className="text-[9px] text-surface-muted uppercase tracking-widest font-bold">Downtown District</p>
            </div>
            <button 
              onClick={handleSignOut}
              className="p-2 hover:bg-surface-card rounded-full text-surface-muted hover:text-red-400 transition-all border border-transparent hover:border-surface-border"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
