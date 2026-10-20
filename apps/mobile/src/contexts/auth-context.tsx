import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Linking } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ensureDeviceRegistered,
  maybeGetExpoPushToken,
} from '@/lib/devices-service';
import {
  completeGoogleSignIn,
  fetchCurrentActor,
  getCurrentSession,
  onAuthStateChange,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  updateProfile as authUpdateProfile,
  type AppActor,
} from '@/lib/auth-service';
import { isAuthConfigured } from '@/lib/config';
import type { AuthRole, PublicAuthUser } from '@/lib/auth-types';
import { getSupabase } from '@/lib/supabase-client';
import { ApiError, setAccessTokenProvider } from '@/lib/api';
import { ACTIVE_REQUEST_STORAGE_KEY } from '@/contexts/active-request-context';
import { requestLocationPermissionOnce } from '@/lib/location-service';

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
  /** Trả về PublicAuthUser để caller navigate theo role chính xác (không stale). */
  login: (input: LoginInput) => Promise<PublicAuthUser>;
  /** `needsEmailConfirmation`: phải xác nhận email rồi mới đăng nhập được. */
  register: (input: RegisterInput) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  /**
   * Cập nhật các trường profile editable. Khi backend đã cấu hình sẽ gọi
   * PATCH /api/v1/auth/profile rồi cập nhật state.
   */
  updateProfile: (input: {
    name?: string;
    phone?: string;
    address?: string;
    avatar?: string;
  }) => Promise<PublicAuthUser>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Convert AppActor từ backend → PublicAuthUser cho UI. */
function actorToPublic(actor: AppActor, fallbackEmail: string): PublicAuthUser {
  const role: AuthRole = actor.roles.includes('rider')
    ? 'rider'
    : actor.roles.includes('mechanic')
      ? 'mechanic'
      : 'rider';
  const result: PublicAuthUser = {
    id: actor.id,
    role,
    name: actor.display_name ?? '',
    email: fallbackEmail,
    phone: actor.phone ?? '',
    avatar: actor.avatar_url ?? '',
  };
  if (actor.address) {
    result.address = actor.address;
  }
  return result;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<PublicAuthUser | null>(null);
  const [role, setRole] = useState<AuthRole | null>(null);

  const backendReady = useMemo(() => isAuthConfigured() && getSupabase() !== null, []);

  // =========================================================
  // Auto xin foreground location permission cho mechanic ngay khi
  // authenticated. Idempotent: chỉ hỏi 1 lần, nếu đã grant thì return
  // ngay không hiện dialog. Lỗi được nuốt (fire-and-forget) để không
  // block auth flow.
  // =========================================================
  useEffect(() => {
    if (status !== 'authenticated' || role !== 'mechanic') return;
    let cancelled = false;
    void (async () => {
      try {
        const granted = await requestLocationPermissionOnce();
        if (cancelled) return;
        if (!granted && __DEV__) {
          // eslint-disable-next-line no-console
          console.log(
            '[auth] Mechanic chưa cấp location permission - auto-tracking sẽ bị skip cho tới khi user bật trong Settings.',
          );
        }
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[auth] requestLocationPermissionOnce failed:', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, role]);

  // =========================================================
  // Subscribe deep-link cho Google OAuth callback
  //
  // Khi user hoàn tất Google sign-in trong browser, Supabase redirect về app
  // qua deep link (vd: `careonroad://auth/callback?code=xxx`).
  // Phải exchange code → session trước, rồi cập nhật state.
  // =========================================================
  useEffect(() => {
    if (!backendReady) return undefined;

    async function handleDeepLink(url: string | null) {
      if (!url) return;
      try {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[auth] Deep-link URL received:', url);
        }
        const parsed = new URL(url);
        // Deep-link format: careonroad://auth/callback?code=xxx
        // (Supabase OAuth PKCE flow)
        const isAuthCallback =
          parsed.pathname.endsWith('/auth/callback') ||
          (parsed.host === 'auth' && parsed.pathname === '/callback') ||
          url.includes('/auth/callback') ||
          url.includes('auth/callback');
        if (!isAuthCallback) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log('[auth] Deep-link không phải auth callback, bỏ qua:', parsed.pathname);
          }
          return;
        }

        const code = parsed.searchParams.get('code');
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log('[auth] Auth callback parsed - code present:', !!code);
        }
        if (!code) {
          // Có thể là implicit flow (token trong fragment) — vẫn thử completeGoogleSignIn
          // để nó fallback sang đọc session từ storage.
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log('[auth] No code in callback, trying session-based flow');
          }
        }

        // Đọc desiredRole từ AsyncStorage (đã set trước khi gọi OAuth).
        let desiredRole: AuthRole = 'rider';
        try {
          const stored = await AsyncStorage.getItem('careonroad.oauth.desired_role');
          if (stored === 'mechanic') desiredRole = 'mechanic';
          // Xoá sau khi đọc để tránh stale state cho lần OAuth sau.
          await AsyncStorage.removeItem('careonroad.oauth.desired_role');
        } catch {
          // ignore storage error → dùng default rider
        }

        // Exchange code → session + bootstrap profile.
        const result = await completeGoogleSignIn(url, desiredRole);
        setUser(result.user);
        setRole(result.user.role);
        setStatus('authenticated');
      } catch (err) {
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[auth] Deep-link OAuth callback failed:', err);
        }
      }
    }

    // Initial URL (app đã mở qua deep-link)
    Linking.getInitialURL().then((url) => handleDeepLink(url));
    // Subscribe URL changes (app đang chạy, user quay lại từ browser)
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => {
      sub.remove();
    };
  }, [backendReady]);

  // =========================================================
  // Hydrate session khi app mount
  //
  // Lưu ý: Nếu có Supabase session nhưng BE /auth/me fail (timeout/mạng),
  // vẫn coi là authenticated dùng minimal actor fallback — tránh xoá session
  // của user chỉ vì BE tạm thời không phản hồi.
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
            try {
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
            } catch (err) {
              // BE từ chối token/tài khoản (khóa, lưu trữ) → đăng xuất, không
              // cho vào app bằng actor giả.
              if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
                await authSignOut().catch(() => undefined);
                if (!cancelled) setStatus('unauthenticated');
                return;
              }
              // BE fail (mạng/5xx): vẫn giữ Supabase session, dùng fallback minimal actor
              // để user không bị buộc login lại khi mạng chập chờn.
              if (__DEV__) {
                // eslint-disable-next-line no-console
                console.warn('[auth] Hydrate BE failed, fallback to cached session:', err);
              }
            }
            // Fallback: dùng email từ Supabase session, role mặc định 'rider'
            // (sẽ được điều chỉnh khi lần fetchCurrentActor tiếp theo thành công).
            if (!cancelled) {
              setUser({
                id: session.user.id,
                role: 'rider',
                name:
                  (session.user.user_metadata?.full_name as string | undefined) ??
                  (session.user.email?.split('@')[0] ?? 'Người dùng'),
                email: session.user.email ?? '',
                phone: (session.user.user_metadata?.phone as string | undefined) ?? '',
                avatar: '',
              });
              setRole('rider');
              setStatus('authenticated');
              // Fallback hydrate: thử đăng ký device (silent fail nếu lỗi).
              try {
                const expoToken = await maybeGetExpoPushToken();
                await ensureDeviceRegistered(expoToken ?? undefined);
              } catch {
                // ignore
              }
            }
            return;
          }
        } catch (err) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[auth] Hydrate Supabase failed:', err);
          }
        }
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      // Thiếu cấu hình Supabase: vẫn hiện màn login (login() sẽ báo lỗi rõ ràng)
      // thay vì kẹt ở 'loading' → màn hình trắng.
      setStatus('unauthenticated');
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [backendReady]);

  // =========================================================
  // Subscribe Supabase auth state changes (token refresh, auto signout...)
  //
  // Chỉ fetch actor ở event INITIAL/SIGNED_IN. TOKEN_REFRESHED chỉ refresh
  // token provider — actor không đổi nên không cần gọi BE lại.
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
      // Bỏ qua TOKEN_REFRESHED để tránh timeout liên tục.
      // Actor (id, role) không đổi khi chỉ refresh token.
      if (event === 'TOKEN_REFRESHED') {
        return;
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
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
            // Sau khi auth thành công: đăng ký device (idempotent, silent fail).
            // Push token (expo) chưa có sẽ lấy từ maybeGetExpoPushToken, optional.
            try {
              const expoToken = await maybeGetExpoPushToken();
              await ensureDeviceRegistered(expoToken ?? undefined);
            } catch {
              // ignore — service đã log warn
            }
          }
        } catch (err) {
          // Không set unauthenticated khi BE fail — giữ state hiện tại.
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[auth] onAuthStateChange BE fetch failed (giữ nguyên state):', err);
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
  //
  // Trả về PublicAuthUser để caller (LoginScreen) navigate theo role chính xác
  // mà không cần đọc stale state từ closure.
  // =========================================================
  const login = useCallback(
    async ({ email, password }: LoginInput): Promise<PublicAuthUser> => {
      if (!backendReady) {
        throw new Error(
          'Backend chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
        );
      }
      const { user: pub } = await authSignIn(email, password);
      setUser(pub);
      setRole(pub.role);
      setStatus('authenticated');
      return pub;
    },
    [backendReady],
  );

  // =========================================================
  // Register
  // =========================================================
  const register = useCallback(
    async ({ role: r, name, email, phone, password }: RegisterInput) => {
      if (!backendReady) {
        throw new Error(
          'Backend chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
        );
      }
      const result = await authSignUp({
        role: r,
        name,
        email,
        phone,
        password,
      });
      if (result.needsEmailConfirmation) {
        return { needsEmailConfirmation: true };
      }
      setUser(result.user);
      setRole(result.user.role);
      setStatus('authenticated');
      return { needsEmailConfirmation: false };
    },
    [backendReady],
  );

  // =========================================================
  // Update profile
  //
  // Gọi PATCH /api/v1/auth/profile rồi refresh actor từ BE.
  // =========================================================
  const updateProfile = useCallback(
    async (input: {
      name?: string;
      phone?: string;
      address?: string;
      avatar?: string;
    }): Promise<PublicAuthUser> => {
      if (!backendReady) {
        throw new Error(
          'Backend chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
        );
      }
      const client = getSupabase();
      if (!client) {
        throw new Error('Supabase chưa được cấu hình.');
      }
      setAccessTokenProvider(() =>
        client.auth.getSession().then((s) => s.data.session?.access_token ?? null),
      );
      await authUpdateProfile(input);
      const actor = await fetchCurrentActor();
      if (!actor) {
        throw new Error('Không lấy được hồ sơ sau khi cập nhật.');
      }
      const nextUser = actorToPublic(actor, user?.email ?? '');
      setUser(nextUser);
      setRole(nextUser.role);
      return nextUser;
    },
    [backendReady, user],
  );

  // =========================================================
  // Logout
  //
  // Luôn reset state local về 'unauthenticated' dù Supabase có lỗi.
  // Throw error để caller (UI) hiển thị banner nếu cần thiết.
  // =========================================================
  const logout = useCallback(async () => {
    if (!backendReady) {
      setUser(null);
      setRole(null);
      setStatus('unauthenticated');
      return;
    }
    let warning: string | null = null;
    try {
      // Không để yêu cầu cứu hộ đang theo dõi của user cũ lọt sang tài khoản kế tiếp.
      await AsyncStorage.removeItem(ACTIVE_REQUEST_STORAGE_KEY).catch(() => undefined);
      await authSignOut();
    } catch (err) {
      // Logout vẫn thành công về mặt UX — session local đã bị xoá.
      // Ghi warning để caller có thể thông báo (vd. "Đăng xuất trên máy chủ thất bại").
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[auth] signOut failed:', err);
      }
      warning =
        err instanceof Error
          ? err.message
          : 'Đăng xuất trên máy chủ thất bại. Phiên local đã được xoá.';
    }
    setUser(null);
    setRole(null);
    setStatus('unauthenticated');
    if (warning) {
      throw new Error(warning);
    }
  }, [backendReady]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      role,
      isBackendConfigured: backendReady,
      login,
      register,
      updateProfile,
      logout,
    }),
    [status, user, role, backendReady, login, register, updateProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
