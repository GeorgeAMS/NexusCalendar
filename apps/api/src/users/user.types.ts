import { User, UserRole, UserStatus } from '@prisma/client';

export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole | null;
  status: UserStatus;
  approvedAt: string | null;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole | null;
  status: UserStatus;
}

/** Usuario autenticado: siempre activo y con rol asignado. */
export interface AuthenticatedUser extends PublicUser {
  role: UserRole;
}

export interface PaginatedUsers {
  items: PublicUser[];
  total: number;
  page: number;
  pageSize: number;
}

/** Perfil minimo para el selector de invitados (sin datos de admin). */
export interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
}

export interface DirectoryUsersResponse {
  items: DirectoryUser[];
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    approvedAt: user.approvedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
