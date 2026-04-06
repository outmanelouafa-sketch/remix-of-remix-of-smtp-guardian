import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'boss' | 'server_manager' | 'smtp_manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  canManageServers: boolean;
  canViewPasswords: boolean;
  canViewActivityLog: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('smtp_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('smtp_user'); }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !data) throw new Error('Invalid email or password');

    const u: User = { id: data.id, name: data.name, email: data.email, role: data.role as UserRole };
    localStorage.setItem('smtp_user', JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('smtp_user');
    setUser(null);
  };

  const canManageServers = user?.role === 'boss' || user?.role === 'server_manager';
  const canViewPasswords = user?.role === 'boss' || user?.role === 'server_manager';
  const canViewActivityLog = user?.role === 'boss';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, canManageServers, canViewPasswords, canViewActivityLog }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
