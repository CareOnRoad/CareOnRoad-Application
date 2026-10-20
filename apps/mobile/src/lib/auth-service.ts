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

/** Cùng regex với backend (auth.schemas.ts) để chặn số sai trước khi tạo tài khoản Supabase. */
const PHONE_REGEX = /^\+?[0-9 .\-()]{9,20}$/;

function metadataString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Lấy actor từ backend; nếu chưa có hồ sơ app (404) thì bootstrap ngay.
 *
 * 404 xảy ra khi: đăng ký cần xác nhận email (chưa có session lúc signUp),
 * bootstrap lần trước lỗi, hoặc Google OAuth lần đầu. Không bootstrap ở đây thì
 * tài khoản bị kẹt: đăng ký lại báo "email đã dùng", đăng nhập báo "chưa có hồ sơ".
 * Role lấy từ `desiredRole`, nếu không có thì từ `user_metadata.account_type`
 * (ghi lúc signUp). Backend chỉ nhận rider|mechanic, mechanic ở trạng thái pending.
 */
async function loadOrBootstrapActor(session: Session, desiredRole?: AuthRole): Promise<AppActor> {
  try {
    return await apiGet<AppActor>('/api/v1/auth/me', { timeoutMs: 20000 });
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const role = desiredRole ?? (meta.account_type === 'mechanic' ? 'mechanic' : 'rider');
  const displayName = metadataString(meta.full_name) ?? metadataString(meta.name);
  const phone = metadataString(meta.phone);
  const avatarUrl = metadataString(meta.avatar_url) ?? metadataString(meta.picture);
  // POST /auth/profile idempotent: profile đã tồn tại thì trả actor hiện có.
  return apiPost<AppActor>(
    '/api/v1/auth/profile',
    {
      account_type: role,
      ...(displayName ? { display_name: displayName.slice(0, 120) } : {}),
      ...(phone && PHONE_REGEX.test(phone) ? { phone } : {}),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    },
    { timeoutMs: 15000 },
  );
}

/** Message tiếng Việt cho lỗi backend khi tải hồ sơ sau đăng nhập. */
function mapActorError(err: unknown): Error {
  if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
    return new Error('Tài khoản đang bị khóa hoặc không còn hoạt động. Vui lòng liên hệ hỗ trợ.');
  }
  return err instanceof Error ? err : new Error('Không tải được hồ sơ tài khoản');
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

/** `needsEmailConfirmation`: Supabase bật "Confirm email" nên signUp chưa trả session. */
export type SignUpResult =
  | { needsEmailConfirmation: true }
  | { needsEmailConfirmation: false; session: Session; actor: AppActor; user: PublicAuthUser };

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
    const actor = await loadOrBootstrapActor(data.session);
    const user: PublicAuthUser = {
      ...actorToPublicUser(actor),
      email: cleanEmail,
    };
    return { session: data.session, actor, user };
  } catch (err) {
    // Không để lại session Supabase "nửa đăng nhập": lần mở app sau hydrate
    // sẽ coi là đã đăng nhập dù backend từ chối (vd tài khoản bị khóa).
    await signOut().catch(() => undefined);
    throw mapActorError(err);
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
  const name = input.name.trim();
  if (!name) throw new Error('Vui lòng nhập họ và tên');
  if (name.length > 120) throw new Error('Họ và tên tối đa 120 ký tự');
  const phone = input.phone?.trim() || undefined;
  if (phone && !PHONE_REGEX.test(phone)) throw new Error('Số điện thoại không hợp lệ');

  const { data, error } = await client.auth.signUp({
    email: cleanEmail,
    password: cleanPassword,
    options: {
      // account_type để bootstrap đúng role ở lần đăng nhập đầu sau khi xác nhận email.
      data: { full_name: name, phone, account_type: input.role },
    },
  });
  if (error) {
    throw mapSupabaseError(error);
  }
  if (!data.session) {
    return { needsEmailConfirmation: true };
  }

  try {
    setAccessTokenProvider(() => client.auth.getSession().then((s) => s.data.session?.access_token ?? null));
    const actor = await loadOrBootstrapActor(data.session, input.role);
    const user: PublicAuthUser = {
      ...actorToPublicUser(actor),
      email: cleanEmail,
    };
    return { needsEmailConfirmation: false, session: data.session, actor, user };
  } catch (err) {
    // Tài khoản Supabase đã tạo; đăng nhập lại sẽ tự bootstrap hồ sơ.
    await signOut().catch(() => undefined);
    throw mapActorError(err);
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

  // Tạo redirect URL từ app scheme: careonroad://auth/callback
  // Lưu ý: createURL trả về URL đầy đủ kèm path; truyền thẳng vào redirectTo.
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

  // PKCE flow: chỉ định flowType='pkce' để Supabase tạo code_verifier và
  // yêu cầu dùng authorization code (thay vì implicit flow với fragment).
  // queryParams cũng được truyền để provider Google chấp nhận offline_access.
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
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
  // Vì `detectSessionInUrl=false` (xem supabase-client.ts), ta exchange thủ công.
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  let session: Session | null = null;

  if (code) {
    // Thử exchange code trước (path bình thường).
    const { data: exchanged, error: exchangeError } =
      await client.auth.exchangeCodeForSession(code);
    if (!exchangeError && exchanged.session) {
      session = exchanged.session;
    } else {
      // Race condition: code đã được consume (vd do background listener đã chạy
      // trước). Đo lường: thử đọc session hiện có — nếu đã tồn tại thì dùng,
      // nếu không thì mới throw error thật.
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          '[auth-service] exchangeCodeForSession failed, kiểm tra session hiện tại:',
          exchangeError?.message,
        );
      }
      const existing = await client.auth.getSession();
      if (existing.data.session) {
        session = existing.data.session;
      } else {
        throw mapSupabaseError(exchangeError);
      }
    }
  } else {
    // Không có code (vd fragment-based implicit flow / token đã được set thẳng).
    // Đọc session hiện tại từ storage.
    const existing = await client.auth.getSession();
    if (!existing.data.session) {
      throw new Error('Callback URL thiếu authorization code.');
    }
    session = existing.data.session;
  }

  if (!session) {
    throw new Error('Không lấy được session từ OAuth callback.');
  }

  setAccessTokenProvider(() =>
    client.auth.getSession().then((s) => s.data.session?.access_token ?? null)
  );

  try {
    const actor = await loadOrBootstrapActor(session, desiredRole);
    const user: PublicAuthUser = {
      ...actorToPublicUser(actor),
      email: session.user.email ?? '',
    };
    return { session, actor, user };
  } catch (err) {
    await signOut().catch(() => undefined);
    throw mapActorError(err);
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
 * Lấy actor hiện tại từ backend (bootstrap hồ sơ nếu chưa có). Trả null khi
 * không có session. Timeout 20s để chờ BE compile lần đầu / mạng LAN chậm.
 */
export async function fetchCurrentActor(): Promise<AppActor | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  if (!data.session) return null;
  setAccessTokenProvider(() =>
    client.auth.getSession().then((s) => s.data.session?.access_token ?? null),
  );
  return loadOrBootstrapActor(data.session);
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
