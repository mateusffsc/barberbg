import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, signIn as supabaseSignIn } from '../lib/supabase';
import { AuthUser, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const authSessionVersion = import.meta.env.VITE_AUTH_SESSION_VERSION ?? '2';
  const authStorageKey = `barbershop_user_v${authSessionVersion}`;
  const legacyAuthStorageKey = 'barbershop_user';
  const forceRefreshEnabled = import.meta.env.VITE_ENABLE_FORCE_REFRESH !== 'false';

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!forceRefreshEnabled) return;

    const channel = supabase
      .channel('app-control', {
        config: {
          broadcast: { self: true }
        }
      })
      .on('broadcast', { event: 'force_refresh' }, () => {
        const now = Date.now();
        const last = sessionStorage.getItem('lastForceRefreshAt');
        if (last && now - Number(last) < 5000) return;
        sessionStorage.setItem('lastForceRefreshAt', String(now));
        window.location.reload();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [forceRefreshEnabled]);

  const checkAuth = async () => {
    try {
      const savedUser = localStorage.getItem(authStorageKey);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
        return;
      }

      const legacySavedUser = localStorage.getItem(legacyAuthStorageKey);
      if (legacySavedUser) {
        if (authSessionVersion === '1') {
          localStorage.setItem(authStorageKey, legacySavedUser);
          setUser(JSON.parse(legacySavedUser));
        }
        localStorage.removeItem(legacyAuthStorageKey);
      }
    } catch (error) {
      console.error('AuthContext: Erro ao verificar auth', error);
      localStorage.removeItem(authStorageKey);
      localStorage.removeItem(legacyAuthStorageKey);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      setLoading(true);
      
      // Use the signIn function from lib/supabase.ts
      const userData = await supabaseSignIn(username, password);
      
      setUser(userData);
      localStorage.setItem(authStorageKey, JSON.stringify(userData));
      
    } catch (error) {
      console.error('AuthContext: Erro no login:', error);
      setLoading(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setUser(null);
      localStorage.removeItem(authStorageKey);
      localStorage.removeItem(legacyAuthStorageKey);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
