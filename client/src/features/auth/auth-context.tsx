import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, refreshSession, tokens } from '@/lib/api';
import type { AuthResponse, Role, User } from '@/lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Extract<Role, 'CUSTOMER' | 'ORGANIZER'>;
}

interface AuthContextValue {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(tokens.refresh ? 'loading' : 'anonymous');

  // Every token change (login, refresh, failed refresh) flows through here.
  useEffect(
    () =>
      tokens.subscribe((session) => {
        setUser(session?.user ?? null);
        setStatus(session ? 'authenticated' : 'anonymous');
      }),
    [],
  );

  // Restore the session after a page reload.
  useEffect(() => {
    if (!tokens.refresh) return;
    refreshSession().then((session) => {
      if (!session) setStatus('anonymous');
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    tokens.set(session);
    return session.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const session = await api<AuthResponse>('/auth/register', { method: 'POST', body: input });
    tokens.set(session);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokens.refresh;
    tokens.clear();
    queryClient.clear();
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, status, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
