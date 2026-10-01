/**
 * Auth service - kết hợp Supabase Auth (login/register/refresh) với backend
 * Next.js (xác định role từ app profile).
 *
 * Flow:
 *   1. supabase.auth.signInWithPassword(email, password)
 *      → trả về session với access_token + refresh_token.
 *   2. backend GET /api/v1/auth/me với Authorization header.
 *      → trả về RequestActor { id, display_name, roles, status }.
 *   3. AuthContext lưu cả Supabase session + derived role vào state.
 *
 * Lỗi từ Supabase (`AuthError`) hoặc backend (`ApiError`) đều được wrap về
 * message tiếng Việt thân thiện với người dùng.
 */

import type { Session, Subscription } from '@supabase/supabase-js';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { createURL } from 'expo-linking';

import { ApiError, apiGet, apiPatch, apiPost, setAccessTokenProvider } from '@/lib/api';
import { getSupabase } from '@/lib/supabase-client';

import type { AuthRole, PublicAuthUser } from './auth-types';

/** Shape trả về từ GET /api/v1/auth/me. */
export interface AppActor {
  id: string;
  display_name?: string;
  phone?: string;
  address?: string;
  avatar_url?: string;
  roles: AuthRole[];
  status: 'active' | 'suspended' | 'archived';
}

/** Email không hợp lệ. */
function ensureEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) throw new Error('Vui lòng nhập email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new Error('Email không hợp lệ');
  }
  return trimmed;
}

function ensurePassword(password: string): string {
  if (!password) throw new Error('Vui lòng nhập mật khẩu');
  if (password.length < 6) throw new Error('Mật khẩu cần ít nhất 6 ký tự');
  return password;
}

/**
 * Map lỗi từ Supabase sang message tiếng Việt.
 *
 * @see https://supabase.com/docs/reference/javascript/auth-error-codes
 */
function mapSupabaseError(err: { message?: string } | null | undefined): Error {
  const msg = err?.message ?? 'Lỗi không xác định';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return new Error('Email hoặc mật khẩu không đúng');
  }
  if (lower.includes('email not confirmed')) {
    return new Error('Email chưa được xác nhận. Vui lòng kiểm tra hộp thư.');
  }
  if (lower.includes('user already registered')) {
    return new Error('Email này đã được sử dụng');
  }
  if (lower.includes('rate limit')) {
    return new Error('Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.');
  }
  if (lower.includes('network')) {
    return new Error('Không thể kết nối tới máy chủ xác thực');
  }
  return new Error(msg);
}

/** Chọn role chính từ actor. */
function pickPrimaryRole(actor: AppActor): AuthRole {
  if (actor.roles.includes('rider')) return 'rider';
  if (actor.roles.includes('mechanic')) return 'mechanic';
  // Mặc định là rider để tránh crash khi role chỉ là admin/mới tạo.
  return 'rider';
}

/** Đảm bảo user có role mong muốn khi đăng ký bằng cách bootstrap profile. */
async function ensureProfileWithRole(
  session: Session,
  desiredRole: AuthRole,
  profilePayload: { displayName?: string; phone?: string; address?: string; avatarUrl?: string },
): Promise<AppActor> {
  // Bootstrapping: backend tạo app_user nếu chưa có (default role = rider).
  // Truyền `account_type` để backend gán role mechanic ngay từ lúc tạo profile
  // (xem POST /api/v1/auth/profile → auth.service.ts → bootstrapProfile).
  try {
    await apiPost<AppActor>(
      '/api/v1/auth/profile',
      {
        display_name: profilePayload.displayName ?? '',
        account_type: desiredRole,
        ...(profilePayload.phone ? { phone: profilePayload.phone } : {}),
        ...(profilePayload.address ? { address: profilePayload.address } : {}),
        ...(profilePayload.avatarUrl ? { avatar_url: profilePayload.avatarUrl } : {}),
      },
      { timeoutMs: 10000 },
    );
  } catch (err) {
    // Nếu profile đã tồn tại (vd qua Google OAuth trước đó), vẫn OK.
    if (err instanceof ApiError && err.status !== 409 && err.status !== 400) {
      throw err;
    }
  }

  // Lấy actor sau khi bootstrap.
  const actor = await apiGet<AppActor>('/api/v1/auth/me', { timeoutMs: 10000 });

  // desiredRole đã được backend xử lý trong POST /api/v1/auth/profile
  // (xem auth.service.ts → bootstrapProfile với input.account_type).
  // Backend đã tự gán role + tạo mechanic_profiles.pending nếu chọn 'mechanic'.
  // Tại client: chỉ cần đọc role thật từ actor và trả về cho AuthContext.
  if (desiredRole === 'mechanic' && !actor.roles.includes('mechanic')) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[auth-service] Backend chưa gán role mechanic. Kiểm tra account_type trong payload.',
      );
    }
  }
  void session; // reserved
  return actor;
}

/** Convert AppActor → PublicAuthUser để store trong client state. */
export function actorToPublicUser(actor: AppActor): PublicAuthUser {
  const result: PublicAuthUser = {
    id: actor.id,
    role: pickPrimaryRole(actor),
    name: actor.display_name ?? '',
    email: '', // Backend không trả email; UI sẽ fallback sang email đã nhập
    phone: actor.phone ?? '',
    avatar: actor.avatar_url ?? '',
  };
  if (actor.address) {
    result.address = actor.address;
  }
  return result;
}

export interface SignInResult {
  session: Session;
  actor: AppActor;
  user: PublicAuthUser;
}

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: AuthRole;
}

export interface SignUpResult {
  session: Session;
  actor: AppActor;
  user: PublicAuthUser;
}

/**
 * Đăng nhập bằng Supabase Auth → lấy profile từ backend.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'Supabase chưa được cấu hình. Vui lòng set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY.',
    );
  }
  const cleanEmail = ensureEmail(email);
  const cleanPassword = ensurePassword(password);

  const { data, error } = await client.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });
  if (error || !data.session) {
    throw mapSupabaseError(error);
  }

  try {
    setAccessTokenProvider(() => client.auth.getSession().then((s) => s.data.session?.access_token ?? null));
    const actor = await apiGet<AppActor>('/api/v1/auth/me', { timeoutMs: 10000 });
    const user: PublicAuthUser = {
      ...actorToPublicUser(actor),
      email: cleanEmail,
    };
    return { session: data.session, actor, user };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      throw new Error(
        'Tài khoản chưa có hồ sơ ứng dụng. Vui lòng đăng ký trước.',
      );
    }
    throw err;
  }
}

/**
 * Đăng ký user mới qua Supabase Auth → bootstrap profile qua backend.
 *
 * Lưu ý: backend hiện chỉ gán default role = rider khi bootstrap.
 * Để chọn role khi đăng ký cần thêm endpoint POST /api/v1/auth/register
 * (sẽ bổ sung sau - AGENTS.md chưa liệt kê endpoint này).
 */
export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'Supabase chưa được cấu hình. Vui lòng set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY.',
    );
  }
  const cleanEmail = ensureEmail(input.email);
  const cleanPassword = ensurePassword(input.password);
  if (!input.name.trim()) throw new Error('Vui lòng nhập họ và tên');

  const { data, error } = await client.auth.signUp({
    email: cleanEmail,
    password: cleanPassword,
    options: {
      data: {
        full_name: input.name,
        phone: input.phone,
      },
    },
  });
  if (error || !data.session) {
    throw mapSupabaseError(error);
  }

  try {
    setAccessTokenProvider(() => client.auth.getSession().then((s) => s.data.session?.access_token ?? null));
    const actor = await ensureProfileWithRole(
      data.session,
      input.role,
      {
        displayName: input.name,
        ...(input.phone ? { phone: input.phone } : {}),
      },
    );
    const user: PublicAuthUser = {
      ...actorToPublicUser(actor),
      email: cleanEmail,
      name: input.name,
      phone: input.phone ?? '',
    };
    return { session: data.session, actor, user };
  } catch (err) {
    // Nếu backend fail (vd do CORS hoặc DB lỗi), vẫn giữ Supabase session
    // để người dùng không bị đăng xuất. AuthContext sẽ show warning.
    if (err instanceof Error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[auth-service] Bootstrap profile thất bại:', err.message);
      }
    }
    throw err;
  }
}

/**
 * Đăng xuất: clear Supabase session + clear API token provider.
 */
export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (client) await client.auth.signOut();
  setAccessTokenProvider(null);
}

/**
 * Đăng nhập / đăng ký bằng Google thông qua Supabase OAuth (web-based flow).
 *
 * Flow:
 *   1. Caller (login.tsx) gọi `startGoogleSignIn({ desiredRole })`.
 *   2. Function lưu desiredRole vào AsyncStorage + gọi Supabase OAuth →
 *      trả về URL để caller mở browser native.
 *   3. User chọn tài khoản Google trong browser, Supabase redirect về app
 *      qua deep link `careonroad://auth/callback?code=xxx`.
 *   4. `auth-context.tsx` subscribe `Linking` events, khi nhận URL:
 *      - Đọc desiredRole từ AsyncStorage.
 *      - Gọi `completeGoogleSignIn(url, desiredRole)` để exchange code → session.
 *      - Cập nhật auth state.
 *
 * Yêu cầu:
 *   - Supabase project đã enable Google provider trong dashboard.
 *   - App scheme `careonroad` đã được config trong app.json.
 */
export interface GoogleSignInOptions {
  /** Role mong muốn sau khi bootstrap profile (rider | mechanic). */
  desiredRole?: AuthRole;
}

/**
 * Mở browser để user đăng nhập Google qua Supabase OAuth.
 *
 * Trả về URL browser sẽ redirect đến (để caller mở bằng WebBrowser).
 *
 * Caller phải subscribe `onAuthStateChange` hoặc deep-link handler trong
 * `auth-context.tsx` để biết khi nào session được tạo.
 */
export async function startGoogleSignIn(
  options: GoogleSignInOptions = {}
): Promise<{ redirectUrl: string }> {
  const client = getSupabase();
  if (!client) {
    throw new Error(
      'Supabase chưa được cấu hình. Vui lòng set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY.',
    );
  }

  const redirectUrl = createURL('auth/callback');

  // Lưu desiredRole vào AsyncStorage để deep-link handler đọc sau khi OAuth
  // redirect về app. Không encode vào redirectTo vì Supabase OAuth chỉ chấp
  // nhận known query params; unknown params sẽ gây lỗi ở một số providers.
  // Storage key là session-scoped nên không leak giữa các user.
  if (options.desiredRole) {
    try {
      await AsyncStorage.setItem(
        'careonroad.oauth.desired_role',
        options.desiredRole,
      );
    } catch {
      // ignore storage error - role sẽ default về 'rider' nếu không đọc được
    }
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    throw mapSupabaseError(error);
  }
  // Mở browser native để user đăng nhập Google.
  // Dùng Linking.openURL thay cho expo-web-browser để tránh thêm dependency.
  // Trên Android emulator cần set CHROME_PACKAGE hoặc cấu hình để mở Chrome.
  const supported = await Linking.canOpenURL(data.url);
  if (!supported) {
    throw new Error('Thiết bị không thể mở trình duyệt để đăng nhập Google.');
  }
  await Linking.openURL(data.url);
  return { redirectUrl: data.url };
}

/**
 * Sau khi OAuth redirect về app, gọi hàm này để lấy session + bootstrap profile.
 *
 * Supabase PKCE flow: Supabase client tự động detect URL có chứa `code` và
 * exchange lấy session. Nếu session tồn tại → bootstrap profile + lấy actor.
 *
 * Role được suy ra từ query `?desired_role=mechanic|rider` (nếu có).
 */
export async function completeGoogleSignIn(
  callbackUrl: string,
  desiredRole: AuthRole = 'rider'
): Promise<SignInResult> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase chưa được cấu hình.');
  }

  // Supabase PKCE: detect code trong URL và đổi lấy session.
  // Nếu detectSessionInUrl=false, phải gọi exchangeCodeForSession thủ công.
  // Client đã set detectSessionInUrl=false để tránh auto-handle; ta exchange thủ công.
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error('Callback URL thiếu authorization code.');
  }
  const { data: exchanged, error: exchangeError } =
    await client.auth.exchangeCodeForSession(code);
  if (exchangeError || !exchanged.session) {
    throw mapSupabaseError(exchangeError);
  }
  const session = exchanged.session;

  setAccessTokenProvider(() =>
    client.auth.getSession().then((s) => s.data.session?.access_token ?? null)
  );

  // Lấy actor (sẽ tự bootstrap nếu chưa có nhờ POST /api/v1/auth/profile bên dưới).
  try {
    const actor = await apiGet<AppActor>('/api/v1/auth/me', { timeoutMs: 10000 });

    const user: PublicAuthUser = {
      ...actorToPublicUser(actor),
      email: session.user.email ?? '',
    };
    return { session, actor, user };
  } catch (err) {
    // 404 → user mới qua Google OAuth, cần bootstrap profile trước.
    if (err instanceof ApiError && err.status === 404) {
      const actor = await ensureProfileWithRole(session, desiredRole, {
        displayName:
          (session.user.user_metadata?.full_name as string | undefined) ??
          (session.user.user_metadata?.name as string | undefined),
        avatarUrl:
          (session.user.user_metadata?.avatar_url as string | undefined) ??
          (session.user.user_metadata?.picture as string | undefined),
      });
      const user: PublicAuthUser = {
        ...actorToPublicUser(actor),
        email: session.user.email ?? '',
      };
      return { session, actor, user };
    }
    throw err;
  }
}

/**
 * Lấy session hiện tại (dùng khi AuthProvider mount để hydrate từ AsyncStorage).
 */
export async function getCurrentSession(): Promise<Session | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

/**
 * Lấy actor hiện tại từ backend.
 *
 * Timeout 20s (lớn hơn default 15s) để chờ BE compile lần đầu / mạng LAN chậm.
 */
export async function fetchCurrentActor(): Promise<AppActor | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  if (!data.session) return null;
  setAccessTokenProvider(() =>
    client.auth.getSession().then((s) => s.data.session?.access_token ?? null),
  );
  try {
    return await apiGet<AppActor>('/api/v1/auth/me', { timeoutMs: 20000 });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Subscribe thay đổi session (login/logout/refresh).
 */
export function onAuthStateChange(
  handler: (event: string, session: Session | null) => void,
): Subscription | null {
  const client = getSupabase();
  if (!client) return null;
  const { data } = client.auth.onAuthStateChange((event, session) => {
    handler(event, session);
  });
  return data.subscription;
}

/**
 * PATCH /api/v1/auth/profile - cập nhật các trường editable của actor hiện tại.
 *
 * Caller phải đảm bảo access_token provider đã được set (AuthContext sẽ tự
 * set sau khi sign-in/sign-up). Trả về actor đã cập nhật.
 */
export interface ProfileUpdateInput {
  name?: string;
  phone?: string;
  address?: string;
  avatar?: string;
}

export async function updateProfile(input: ProfileUpdateInput): Promise<AppActor> {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase chưa được cấu hình.');
  }
  setAccessTokenProvider(() =>
    client.auth.getSession().then((s) => s.data.session?.access_token ?? null),
  );
  const payload: Record<string, string> = {};
  if (input.name !== undefined) payload.display_name = input.name;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.address !== undefined) payload.address = input.address;
  if (input.avatar !== undefined) payload.avatar_url = input.avatar;
  return await apiPatch<AppActor>('/api/v1/auth/profile', payload, {
    timeoutMs: 15000,
  });
}
