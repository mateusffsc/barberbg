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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const savedUser = localStorage.getItem('barbershop_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('AuthContext: Erro ao verificar auth', error);
      localStorage.removeItem('_user');
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
      localStorage.setItem('barbershop_user', JSON.stringify(userData));
      
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
      localStorage.removeItem('barbershop_user');
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