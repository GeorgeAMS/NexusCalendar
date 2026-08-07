/** Eventos notificables de la v1 (docs/06-notificaciones-pwa.md). */
export type NotificationType =
  | 'account.approved'
  | 'reservation.invite'
  | 'reservation.overridden'
  | 'reservation.cancelled';

/**
 * Un destinatario siempre tiene correo; `userId` solo existe si el invitado ya
 * tiene cuenta, y es lo que habilita el push y el historial in-app.
 */
export interface NotificationRecipient {
  email: string;
  userId?: string | null;
}

export interface NotificationMessage {
  /** Asunto del correo. */
  subject: string;
  /** Titulo corto para push e in-app. */
  title: string;
  /** Resumen de una linea para push e in-app. */
  body: string;
  /** Cuerpo completo del correo. */
  text: string;
}

export interface NotificationPayload {
  reservationId?: string;
  [key: string]: unknown;
}

export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  renotify: boolean;
  data: NotificationPayload & { type: NotificationType };
}

export interface InboxItem {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}
