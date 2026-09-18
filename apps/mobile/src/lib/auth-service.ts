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

import { ApiError, apiGet, apiPost, setAccessTokenProvider } from '@/lib/api';
import { getSupabase } from '@/lib/supabase-client';

import type { AuthRole, PublicAuthUser } from './auth-types';

/** Shape trả về từ GET /api/v1/auth/me. */
export interface AppActor {
  id: string;
  display_name?: string;
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
  displayName?: string,
): Promise<AppActor> {
  // Bootstrapping: backend tạo app_user nếu chưa có (default role = rider).
  try {
    await apiPost<AppActor>(
      '/api/v1/auth/profile',
      { display_name: displayName ?? '' },
      { timeoutMs: 10000 },
    );
  } catch (err) {
    // Nếu profile đã tồn tại với role khác, vẫn OK.
    if (err instanceof ApiError && err.status !== 409 && err.status !== 400) {
      throw err;
    }
  }

  // Lấy actor sau khi bootstrap.
  const actor = await apiGet<AppActor>('/api/v1/auth/me', { timeoutMs: 10000 });

  // Đăng ký mới mặc định role = rider (backend tự set).
  // Nếu muốn mechanic mà backend chưa có endpoint role-grant
  // thì caller sẽ nhận role rider và phải dùng flow đặc biệt (hiện chưa impl).
  if (desiredRole === 'mechanic' && !actor.roles.includes('mechanic')) {
    // Trong prototype: chấp nhận role hiện tại nhưng ghi log để theo dõi.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(
        '[auth-service] Đăng ký mechanic: backend chưa hỗ trợ gán role mechanic ' +
          'từ client. Tài khoản sẽ ở role mặc định của backend.',
      );
    }
  }
  void session; // reserved
  return actor;
}

/** Convert AppActor → PublicAuthUser để store trong client state. */
export function actorToPublicUser(actor: AppActor): PublicAuthUser {
  return {
    id: actor.id,
    role: pickPrimaryRole(actor),
    name: actor.display_name ?? '',
    email: '', // Backend không trả email; UI sẽ fallback sang email đã nhập
    phone: '',
    avatar: '',
  };
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
      input.name,
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
    return await apiGet<AppActor>('/api/v1/auth/me', { timeoutMs: 10000 });
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
