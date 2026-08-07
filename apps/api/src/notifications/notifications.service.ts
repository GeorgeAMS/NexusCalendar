import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { InboxService } from './inbox.service';
import { MailerService } from './mailer.service';
import {
  NotificationMessage,
  NotificationPayload,
  NotificationRecipient,
  NotificationType,
} from './notification.types';
import { PushService } from './push.service';
import {
  ReservationSummary,
  accountApprovedTemplate,
  reservationCancelledTemplate,
  reservationInviteTemplate,
  reservationOverriddenTemplate,
} from './templates';

interface DeliveryRequest {
  type: NotificationType;
  recipients: NotificationRecipient[];
  message: NotificationMessage;
  payload?: NotificationPayload;
  /** Agrupa el push del mismo evento para no apilar duplicados. */
  tag: string;
}

/**
 * Puerto de notificaciones: el dominio publica un evento y este servicio lo
 * reparte a correo, push e historial in-app. Ningun fallo de canal se propaga.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly mailer: MailerService,
    private readonly push: PushService,
    private readonly inbox: InboxService,
    private readonly config: ConfigService,
  ) {}

  async accountApproved(account: {
    userId?: string | null;
    fullName: string;
    email: string;
    role: UserRole;
  }): Promise<void> {
    await this.deliver({
      type: 'account.approved',
      recipients: [{ email: account.email, userId: account.userId }],
      message: accountApprovedTemplate({
        fullName: account.fullName,
        role: account.role,
        webUrl: this.webUrl(),
      }),
      tag: 'account-approved',
    });
  }

  async reservationInvite(input: {
    reservationId: string;
    reservation: ReservationSummary;
    recipients: NotificationRecipient[];
  }): Promise<void> {
    await this.deliver({
      type: 'reservation.invite',
      recipients: input.recipients,
      message: reservationInviteTemplate({
        reservation: input.reservation,
        webUrl: this.webUrl(),
      }),
      payload: { reservationId: input.reservationId },
      tag: `reservation-${input.reservationId}`,
    });
  }

  async reservationOverridden(input: {
    reservationId: string;
    reservation: ReservationSummary;
    replacement: ReservationSummary;
    takenBy: string;
    recipients: NotificationRecipient[];
  }): Promise<void> {
    await this.deliver({
      type: 'reservation.overridden',
      recipients: input.recipients,
      message: reservationOverriddenTemplate({
        reservation: input.reservation,
        replacement: input.replacement,
        takenBy: input.takenBy,
        webUrl: this.webUrl(),
      }),
      payload: { reservationId: input.reservationId },
      tag: `reservation-${input.reservationId}`,
    });
  }

  async reservationCancelled(input: {
    reservationId: string;
    reservation: ReservationSummary;
    cancelledBy: string;
    recipients: NotificationRecipient[];
  }): Promise<void> {
    await this.deliver({
      type: 'reservation.cancelled',
      recipients: input.recipients,
      message: reservationCancelledTemplate({
        reservation: input.reservation,
        cancelledBy: input.cancelledBy,
        webUrl: this.webUrl(),
      }),
      payload: { reservationId: input.reservationId },
      tag: `reservation-${input.reservationId}`,
    });
  }

  private async deliver(request: DeliveryRequest): Promise<void> {
    const recipients = this.dedupe(request.recipients);
    if (recipients.length === 0) {
      return;
    }

    for (const recipient of recipients) {
      try {
        await this.mailer.send({
          to: recipient.email,
          subject: request.message.subject,
          text: request.message.text,
        });
      } catch (error) {
        this.logger.error(
          `No se pudo enviar ${request.type} a ${recipient.email}`,
          error,
        );
      }
    }

    const userIds = recipients
      .map((recipient) => recipient.userId)
      .filter((userId): userId is string => Boolean(userId));

    if (userIds.length === 0) {
      return;
    }

    try {
      await this.inbox.record(userIds, request.type, request.message, request.payload);
    } catch (error) {
      this.logger.error(`No se pudo guardar el historial de ${request.type}`, error);
    }

    try {
      await this.push.sendToUsers(userIds, {
        title: request.message.title,
        body: request.message.body,
        tag: request.tag,
        renotify: true,
        data: { ...request.payload, type: request.type },
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el push de ${request.type}`, error);
    }
  }

  /** Un mismo correo puede llegar como organizador y como invitado. */
  private dedupe(recipients: NotificationRecipient[]): NotificationRecipient[] {
    const unique = new Map<string, NotificationRecipient>();

    for (const recipient of recipients) {
      const email = recipient.email.trim().toLowerCase();
      if (!email) {
        continue;
      }

      const existing = unique.get(email);
      unique.set(email, {
        email,
        userId: recipient.userId ?? existing?.userId ?? null,
      });
    }

    return [...unique.values()];
  }

  private webUrl(): string {
    const explicit = this.config.get<string>('APP_WEB_URL');
    if (explicit) {
      return explicit;
    }

    const cors = this.config.get<string>('CORS_ORIGIN');
    return cors?.split(',')[0].trim() ?? 'http://localhost:5173';
  }
}
