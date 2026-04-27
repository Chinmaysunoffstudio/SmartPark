import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety timeout to ensure app doesn't stay in loading state forever
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.error('Session error:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event change:', event, session?.user?.id);
      
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const fetchProfile = async (uid: string, email: string) => {
    console.log('Fetching profile for:', uid);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('uid', uid)
        .maybeSingle();

      if (data) {
        console.log('Profile found:', data);
        setProfile(data as UserProfile);
      } else {
        console.log('Profile not found or error, creating default if needed:', error);
        // Profile doesn't exist, create it
        const selectedRole = sessionStorage.getItem('pending_role') as UserRole || UserRole.USER;
        
        const newProfile: UserProfile = {
          uid: uid,
          email: email || '',
          role: selectedRole,
          createdAt: new Date().toISOString(),
        };
        
        // Try to insert, but don't block on error
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([newProfile]);
          
        if (insertError) {
          console.error('Profile insertion error (likely RLS):', insertError);
        }
        
        // Set profile locally even if DB insert fails so user can proceed
        setProfile(newProfile);
        sessionStorage.removeItem('pending_role');
      }
    } catch (err) {
      console.error('Fatal fetchProfile error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin: profile?.role === UserRole.ADMIN }}>
      {children}
    </AuthContext.Provider>
  );
};
