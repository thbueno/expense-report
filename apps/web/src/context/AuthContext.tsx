import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, setToken, clearToken } from '../lib/api';

interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJWT(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem('token')
  );
  const [user, setUser] = useState<AuthUser | null>(() => {
    const t = localStorage.getItem('token');
    return t ? parseJWT(t) : null;
  });

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setToken(res.token);
    setTokenState(res.token);
    setUser(parseJWT(res.token));
  };

  const signup = async (email: string, password: string, role?: string) => {
    const res = await api.signup({ email, password, role });
    setToken(res.token);
    setTokenState(res.token);
    setUser(parseJWT(res.token));
  };

  const logout = () => {
    clearToken();
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
