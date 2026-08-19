import { api } from "./client";
import type {
  AdminUsersResponse,
  AuthUser,
  CreateReservationBody,
  DirectoryUsersResponse,
  LoginResponse,
  NotificationsResponse,
  Reservation,
  ReservationStatus,
  Room,
  UserRole,
  UserStatus,
} from "./types";

export const authApi = {
  register: (body: { fullName: string; email: string; phone: string; password: string }) =>
    api<AuthUser>("/auth/register", { method: "POST", body, auth: false }),
  login: (body: { email: string; password: string }) =>
    api<LoginResponse>("/auth/login", { method: "POST", body, auth: false }),
  me: () => api<AuthUser>("/auth/me"),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<{ ok: true }>("/auth/change-password", { method: "POST", body }),
};

export const roomsApi = {
  list: () => api<{ items: Room[] }>("/rooms"),
};

export const usersApi = {
  directory: (query: { q?: string | undefined; limit?: number | undefined } = {}) =>
    api<DirectoryUsersResponse>("/users/directory", { query }),
};

export const reservationsApi = {
  list: (query: {
    from?: string | undefined;
    to?: string | undefined;
    roomId?: string | undefined;
    status?: ReservationStatus | undefined;
  }) =>
    api<{ items: Reservation[] }>("/reservations", { query }),
  get: (id: string) => api<Reservation>(`/reservations/${id}`),
  create: (body: CreateReservationBody) =>
    api<Reservation>("/reservations", { method: "POST", body }),
  cancel: (id: string) => api<void>(`/reservations/${id}`, { method: "DELETE" }),
};

export const adminApi = {
  users: (query: {
    status?: UserStatus | undefined;
    role?: UserRole | undefined;
    q?: string | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  }) => api<AdminUsersResponse>("/admin/users", { query }),
  approve: (id: string, role: "usuario" | "gerencia") =>
    api<AuthUser>(`/admin/users/${id}/approve`, { method: "PATCH", body: { role } }),
  reject: (id: string) => api<AuthUser>(`/admin/users/${id}/reject`, { method: "PATCH" }),
  setRole: (id: string, role: "usuario" | "gerencia") =>
    api<AuthUser>(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }),
  disable: (id: string) => api<AuthUser>(`/admin/users/${id}`, { method: "DELETE" }),
  create: (body: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    role: "usuario" | "gerencia";
  }) => api<AuthUser>("/admin/users", { method: "POST", body }),
};

export const notificationsApi = {
  list: (query: { unread?: boolean | undefined; limit?: number | undefined } = {}) =>
    api<NotificationsResponse>("/notifications", { query }),
  markRead: (ids?: string[]) =>
    api<{ updated: number }>("/notifications/read", {
      method: "POST",
      body: ids ? { ids } : {},
    }),
};

export const pushApi = {
  publicKey: () => api<{ publicKey: string | null }>("/push/public-key"),
  subscribe: (body: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api<{ id: string }>("/push/subscribe", { method: "POST", body }),
  unsubscribe: (endpoint: string) =>
    api<void>("/push/subscribe", { method: "DELETE", body: { endpoint } }),
};
