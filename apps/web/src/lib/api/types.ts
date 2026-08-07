export type UserRole = "admin" | "gerencia" | "usuario";
export type UserStatus = "pending" | "active" | "rejected" | "disabled";
export type ReservationStatus = "confirmed" | "cancelled" | "overridden";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: UserRole | null;
  status: UserStatus;
  approvedAt?: string | null;
  createdAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface Room {
  id: string;
  name: string;
  slug: string;
  locationNote: string | null;
  isActive: boolean;
}

export interface Invitee {
  email: string;
  userId: string | null;
  inviteStatus: string;
}

export interface Reservation {
  id: string;
  roomId: string;
  roomName: string;
  organizerId: string;
  organizerName: string;
  title: string;
  description: string | null;
  meetingDate: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  invitees: Invitee[];
  createdAt: string;
}

export interface CreateReservationBody {
  roomId: string;
  title: string;
  description?: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  inviteeEmails: string[];
  force?: boolean;
}

export interface ConflictDetail {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  roomName?: string;
  organizerName: string;
}

export interface RoomConflictDetails {
  conflicts: ConflictDetail[];
  canOverride: boolean;
}

export interface AppNotification {
  id: string;
  type:
    | "account.approved"
    | "reservation.invite"
    | "reservation.overridden"
    | "reservation.cancelled";
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  items: AppNotification[];
  unread: number;
}

export interface AdminUsersResponse {
  items: AuthUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DirectoryUser {
  id: string;
  fullName: string;
  email: string;
}

export interface DirectoryUsersResponse {
  items: DirectoryUser[];
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_PENDING"
  | "ACCOUNT_REJECTED"
  | "ACCOUNT_DISABLED"
  | "EMAIL_TAKEN"
  | "ROOM_CONFLICT"
  | "ADVANCE_NOTICE"
  | "NOT_FOUND"
  | "NETWORK_ERROR";
