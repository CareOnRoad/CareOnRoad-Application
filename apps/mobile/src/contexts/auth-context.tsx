import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  clearSession,
  findUserByEmail,
  loadSession,
  registerUser as registerDemoUser,
  saveSession as saveDemoSession,
} from '@/lib/auth-storage';
import {
  fetchCurrentActor,
  getCurrentSession,
  onAuthStateChange,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  type AppActor,
} from '@/lib/auth-service';
import { isAuthConfigured } from '@/lib/config';
import type { AuthRole, PublicAuthUser, StoredAuthSession } from '@/lib/auth-types';
import { toPublicUser } from '@/lib/auth-types';
import { getSupabase } from '@/lib/supabase-client';

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  role: AuthRole;
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface AuthState {
  status: AuthStatus;
  user: PublicAuthUser | null;
  role: AuthRole | null;
  /** Cho biết app đang dùng Supabase thật (true) hay demo mode (false). */
  isBackendConfigured: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Đổi vai trò demo - chỉ hoạt động trong demo mode. */
  switchRoleDemo: () => Promise<void>;
  /**
   * Bypass login (CHỈ dành cho dev/test UI - sẽ xoá khi tích hợp backend).
   * Tạo session demo với role + email mặc định không cần mật khẩu.
   */
  bypassLoginAs: (role: AuthRole) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Convert AppActor từ backend → PublicAuthUser cho UI. */
function actorToPublic(actor: AppActor, fallbackEmail: string): PublicAuthUser {
  const role: AuthRole = actor.roles.includes('rider')
    ? 'rider'
    : actor.roles.includes('mechanic')
      ? 'mechanic'
      : 'rider';
  return {
    id: actor.id,
    role,
    name: actor.display_name ?? '',
    email: fallbackEmail,
    phone: '',
    avatar: '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicAuthUser | null>(null);
  const [role, setRole] = useState<AuthRole | null>(null);
  // Track phiên demo (chỉ dùng khi Supabase chưa cấu hình)
  const [demoSession, setDemoSession] = useState<StoredAuthSession | null>(null);

  const backendReady = useMemo(() => isAuthConfigured() && getSupabase() !== null, []);

  // =========================================================
  // Hydrate session khi app mount
  // =========================================================
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Backend ready → dùng Supabase + backend
      if (backendReady) {
        try {
          const session = await getCurrentSession();
          if (cancelled) return;
          if (session) {
            const actor = await fetchCurrentActor();
            if (cancelled) return;
            if (actor) {
              setUser(actorToPublic(actor, session.user.email ?? ''));
              setRole(
                actor.roles.includes('rider')
                  ? 'rider'
                  : actor.roles.includes('mechanic')
                    ? 'mechanic'
                    : 'rider',
              );
              setStatus('authenticated');
              return;
            }
          }
        } catch (err) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[auth] Hydrate failed:', err);
          }
        }
        if (!cancelled) setStatus('unauthenticated');
        return;
      }

      // Demo mode → dùng AsyncStorage
      try {
        const stored = await loadSession();
        if (cancelled) return;
        if (stored) {
          setDemoSession(stored);
          setUser(stored.user);
          setRole(stored.user.role);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      } catch {
        if (!cancelled) setStatus('unauthenticated');
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [backendReady]);

  // =========================================================
  // Subscribe Supabase auth state changes (token refresh, auto signout...)
  // =========================================================
  useEffect(() => {
    if (!backendReady) return undefined;
    const sub = onAuthStateChange(async (event, supabaseSession) => {
      if (event === 'SIGNED_OUT' || !supabaseSession) {
        setUser(null);
        setRole(null);
        setStatus('unauthenticated');
        return;
      }
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        try {
          const actor = await fetchCurrentActor();
          if (actor) {
            setUser(actorToPublic(actor, supabaseSession.user.email ?? ''));
            setRole(
              actor.roles.includes('rider')
                ? 'rider'
                : actor.roles.includes('mechanic')
                  ? 'mechanic'
                  : 'rider',
            );
            setStatus('authenticated');
          }
        } catch (err) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[auth] onAuthStateChange handler failed:', err);
          }
        }
      }
    });
    return () => {
      sub?.unsubscribe();
    };
  }, [backendReady]);

  // =========================================================
  // Login
  // =========================================================
  const login = useCallback(
    async ({ email, password }: LoginInput) => {
      if (backendReady) {
        const { user: pub } = await authSignIn(email, password);
        setUser(pub);
        setRole(pub.role);
        setStatus('authenticated');
        return;
      }
      // Demo fallback
      const existing = await findUserByEmail(email);
      if (!existing || existing.password !== password) {
        throw new Error('Email hoặc mật khẩu không đúng');
      }
      const newSession: StoredAuthSession = {
        user: toPublicUser(existing),
        token: `demo-token-${Date.now()}`,
        issuedAt: new Date().toISOString(),
      };
      await saveDemoSession(newSession);
      setDemoSession(newSession);
      setUser(newSession.user);
      setRole(newSession.user.role);
      setStatus('authenticated');
    },
    [backendReady],
  );

  // =========================================================
  // Register
  // =========================================================
  const register = useCallback(
    async ({ role: r, name, email, phone, password }: RegisterInput) => {
      if (backendReady) {
        const { user: pub } = await authSignUp({
          role: r,
          name,
          email,
          phone,
          password,
        });
        setUser(pub);
        setRole(pub.role);
        setStatus('authenticated');
        return;
      }
      // Demo fallback
      const created = await registerDemoUser({ role: r, name, email, phone, password });
      const newSession: StoredAuthSession = {
        user: toPublicUser(created),
        token: `demo-token-${Date.now()}`,
        issuedAt: new Date().toISOString(),
      };
      await saveDemoSession(newSession);
      setDemoSession(newSession);
      setUser(newSession.user);
      setRole(newSession.user.role);
      setStatus('authenticated');
    },
    [backendReady],
  );

  // =========================================================
  // Logout
  // =========================================================
  const logout = useCallback(async () => {
    if (backendReady) {
      await authSignOut();
    } else {
      await clearSession();
    }
    setUser(null);
    setRole(null);
    setDemoSession(null);
    setStatus('unauthenticated');
  }, [backendReady]);

  // =========================================================
  // Switch role demo (chỉ dùng trong demo mode)
  // =========================================================
  const switchRoleDemo = useCallback(async () => {
    if (backendReady) {
      // Trong production cần logout + login với tài khoản khác.
      throw new Error('switchRoleDemo không khả dụng khi đã tích hợp backend');
    }
    if (!demoSession) return;
    const flipped: AuthRole = demoSession.user.role === 'rider' ? 'mechanic' : 'rider';
    const counterpart = await findUserByEmail(
      flipped === 'rider' ? 'rider1@gmail.com' : 'mechanic1@gmail.com',
    );
    if (!counterpart) return;
    const newSession: StoredAuthSession = {
      user: toPublicUser(counterpart),
      token: `demo-token-${Date.now()}`,
      issuedAt: new Date().toISOString(),
    };
    await saveDemoSession(newSession);
    setDemoSession(newSession);
    setUser(newSession.user);
    setRole(newSession.user.role);
  }, [backendReady, demoSession]);

  // =========================================================
  // Bypass login (dev only - sẽ xoá khi tích hợp backend)
  // =========================================================
  const bypassLoginAs = useCallback(
    async (targetRole: AuthRole) => {
      // Lấy thông tin seed user trước (dùng SEED_USERS nếu AsyncStorage trống).
      const email = targetRole === 'rider' ? 'rider1@gmail.com' : 'mechanic1@gmail.com';
      const seed = await findUserByEmail(email);
      if (!seed) {
        throw new Error('Không tìm thấy tài khoản demo để bypass');
      }
      // Nếu đã tích hợp Supabase, vẫn tiếp tục ghi đè session local để test UI
      // (bypass vẫn dùng AsyncStorage, không gọi Supabase).
      const newSession: StoredAuthSession = {
        user: toPublicUser(seed),
        token: `demo-bypass-${Date.now()}`,
        issuedAt: new Date().toISOString(),
      };
      await saveDemoSession(newSession);
      setDemoSession(newSession);
      setUser(newSession.user);
      setRole(newSession.user.role);
      setStatus('authenticated');
    },
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      role,
      isBackendConfigured: backendReady,
      login,
      register,
      logout,
      switchRoleDemo,
      bypassLoginAs,
    }),
    [status, user, role, backendReady, login, register, logout, switchRoleDemo, bypassLoginAs],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
