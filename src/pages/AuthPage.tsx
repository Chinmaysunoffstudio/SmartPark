import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Car, Shield, ArrowLeft, ArrowRight, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';

export default function AuthPage({ onBack }: { onBack: () => void }) {
  const { user, profile } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.USER);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated but waiting for profile, show processing state
  if (user && !profile) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 border-4 border-blue-600/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <Lock className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-surface-text uppercase tracking-widest">Handshake Verified</h2>
            <p className="text-surface-muted text-[10px] uppercase font-bold tracking-[0.3em]">Decrypting Profile Node...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);
    sessionStorage.setItem('pending_role', selectedRole);

    // Safety timeout for the auth process itself
    const authTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('The authentication process is taking longer than expected. Please check your connection or try again.');
      }
    }, 15000);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { role: selectedRole },
            emailRedirectTo: window.location.origin
          }
        });
        
        if (signUpError) {
          if (signUpError.message === 'User already registered') {
            throw new Error('This email is already registered. Please switch to "AUTHENTICATE" mode below to sign in.');
          }
          throw signUpError;
        }

        // If a session exists, we were signed in automatically (email confirmation is off)
        if (data.session) {
          clearTimeout(authTimeout);
          return;
        }

        setSuccess(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          if (signInError.message === 'Invalid login credentials') {
            throw new Error('Invalid email or password. Please verify your credentials or create a new account.');
          }
          throw signInError;
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Access denied. Please check your credentials.');
      sessionStorage.removeItem('pending_role');
    } finally {
      clearTimeout(authTimeout);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-surface-muted hover:text-surface-text transition-colors text-xs font-bold uppercase tracking-widest group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Landing
        </button>

        <div className="text-center">
          <div className="inline-flex p-3 bg-blue-600 rounded-2xl shadow-xl shadow-blue-900/20 mb-6 font-display">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-black text-surface-text uppercase tracking-tight mb-2">Initialize identity</h1>
          <p className="text-surface-muted text-[10px] font-black uppercase tracking-widest">Select your access portal to begin.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => !success && setSelectedRole(UserRole.USER)}
            disabled={success}
            className={`p-6 rounded-[32px] border transition-all text-left group relative overflow-hidden ${
              selectedRole === UserRole.USER 
                ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-600/20' 
                : 'glass border-white/5 hover:border-white/20'
            } ${success ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`p-2 rounded-xl mb-4 w-fit transition-colors ${
              selectedRole === UserRole.USER ? 'bg-surface-bg text-blue-600' : 'bg-surface-card text-surface-muted'
            }`}>
              <Car className="w-5 h-5" />
            </div>
            <p className={`font-black uppercase text-[10px] tracking-widest mb-1 ${selectedRole === UserRole.USER ? 'text-white' : 'text-surface-muted'}`}>User Node</p>
            <p className={`text-[9px] leading-tight font-medium ${selectedRole === UserRole.USER ? 'text-blue-100' : 'text-surface-muted/60'}`}>Find and book parking slots instantly.</p>
          </button>

          <button
            onClick={() => !success && setSelectedRole(UserRole.ADMIN)}
            disabled={success}
            className={`p-6 rounded-[32px] border transition-all text-left group relative overflow-hidden ${
              selectedRole === UserRole.ADMIN 
                ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-600/20' 
                : 'glass border-white/5 hover:border-white/20'
            } ${success ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className={`p-2 rounded-xl mb-4 w-fit transition-colors ${
              selectedRole === UserRole.ADMIN ? 'bg-surface-bg text-blue-600' : 'bg-surface-card text-surface-muted'
            }`}>
              <Shield className="w-5 h-5" />
            </div>
            <p className={`font-black uppercase text-[10px] tracking-widest mb-1 ${selectedRole === UserRole.ADMIN ? 'text-white' : 'text-surface-muted'}`}>Admin Node</p>
            <p className={`text-[9px] leading-tight font-medium ${selectedRole === UserRole.ADMIN ? 'text-blue-100' : 'text-surface-muted/60'}`}>Manage infrastructure & monitor flow.</p>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!success ? (
            <motion.form 
              key="auth-form"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleAuth} 
              className="space-y-4"
            >
              <div className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted" />
                  <input
                    type="email"
                    placeholder="EMAIL ADDRESS"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full glass rounded-2xl py-4 pl-12 pr-4 text-surface-text placeholder:text-surface-muted focus:outline-none focus:border-blue-500/50 transition-colors uppercase text-xs tracking-widest font-mono"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-muted" />
                  <input
                    type="password"
                    placeholder="ACCOUNT PASSWORD"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full glass rounded-2xl py-4 pl-12 pr-4 text-surface-text placeholder:text-surface-muted focus:outline-none focus:border-blue-500/50 transition-colors uppercase text-xs tracking-widest font-mono"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-[10px] uppercase font-bold tracking-widest bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                  {error}
                </p>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 bg-surface-text text-surface-bg hover:opacity-90 disabled:bg-surface-card disabled:text-surface-muted/50 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 group shadow-xl shadow-surface-text/5"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? 'Create Account' : 'Sign In Now'}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-surface-muted hover:text-surface-text text-[10px] uppercase font-black tracking-widest transition-colors"
                >
                  {isSignUp ? 'Already registered? Authenticate' : 'New Identity? Register Node'}
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div 
              key="auth-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-8 bg-blue-600/10 border border-blue-500/30 rounded-3xl text-center space-y-4 shadow-2xl shadow-blue-900/20"
            >
              <div className="inline-flex p-3 bg-blue-600/20 rounded-full text-blue-500 mb-2">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-surface-text font-black uppercase tracking-widest text-sm">Account Node Created</h3>
              <p className="text-surface-muted text-xs leading-relaxed font-mono">
                Your identity has been registered for <span className="text-blue-400">{email}</span>. 
                If you aren't redirected automatically, please verify your email or sign in below.
              </p>
              <button 
                onClick={() => {
                  setSuccess(false);
                  setIsSignUp(false);
                }}
                className="text-blue-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-blue-400 transition-colors"
              >
                Go to Sign In
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-[10px] text-surface-muted uppercase tracking-tighter max-w-[240px] mx-auto font-mono">
          Secure biometric handshake initiated. All sessions are encrypted and synced to the cloud grid.
        </p>
      </motion.div>
    </div>
  );
}
