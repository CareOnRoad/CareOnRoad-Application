/**
 * Auth storage helpers
 * - Lưu thông tin user vào AsyncStorage (chưa tích hợp API)
 * - Mọi giá trị đều local; sẽ thay bằng API calls khi tích hợp backend.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthRole, AuthUser, StoredAuthSession } from '@/lib/auth-types';

const SESSION_KEY = 'careonroad.auth.session.v1';
const USERS_KEY = 'careonroad.auth.users.v1';

// Một danh sách user mẫu để demo UI khi chưa có backend.
const SEED_USERS: AuthUser[] = [
  {
    id: 'u_rider_demo',
    role: 'rider',
    name: 'Nguyễn Văn An',
    email: 'rider1@gmail.com',
    phone: '+84 90 555 1234',
    avatar: 'https://i.pravatar.cc/200?img=15',
    password: 'demo1234',
  },
  {
    id: 'u_mechanic_demo',
    role: 'mechanic',
    name: 'Trần Minh Quân',
    email: 'mechanic1@gmail.com',
    phone: '+84 90 555 5678',
    avatar: 'https://i.pravatar.cc/200?img=12',
    password: 'demo1234',
  },
];

export async function loadSeedUsers(): Promise<AuthUser[]> {
  const stored = await AsyncStorage.getItem(USERS_KEY);
  if (!stored) {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
    return SEED_USERS;
  }
  try {
    const parsed = JSON.parse(stored) as AuthUser[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return SEED_USERS;
  } catch {
    return SEED_USERS;
  }
}

export async function saveUsers(users: AuthUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function loadSession(): Promise<StoredAuthSession | null> {
  const stored = await AsyncStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as StoredAuthSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredAuthSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function findUserByEmail(email: string): Promise<AuthUser | undefined> {
  const users = await loadSeedUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function emailExists(email: string): Promise<boolean> {
  const users = await loadSeedUsers();
  return users.some((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function registerUser(input: {
  role: AuthRole;
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<AuthUser> {
  const users = await loadSeedUsers();
  const newUser: AuthUser = {
    id: `u_${Date.now()}`,
    role: input.role,
    name: input.name,
    email: input.email,
    phone: input.phone,
    avatar: `https://i.pravatar.cc/200?u=${encodeURIComponent(input.email)}`,
    password: input.password,
  };
  await saveUsers([...users, newUser]);
  return newUser;
}

export type { AuthRole, AuthUser, StoredAuthSession };
