/**
 * Local auth types - chỉ phục vụ UI prototype.
 * Sẽ được thay bằng types từ backend contracts khi tích hợp API.
 */
export type AuthRole = 'rider' | 'mechanic';

export interface AuthUser {
  id: string;
  role: AuthRole;
  name: string;
  email: string;
  phone: string;
  address?: string;
  avatar: string;
  password: string;
}

export interface PublicAuthUser {
  id: string;
  role: AuthRole;
  name: string;
  email: string;
  phone: string;
  address?: string;
  avatar: string;
}

export interface StoredAuthSession {
  user: PublicAuthUser;
  token: string;
  issuedAt: string;
}

export function toPublicUser(user: AuthUser): PublicAuthUser {
  const result: PublicAuthUser = {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
  };
  if (user.address) {
    result.address = user.address;
  }
  return result;
}
