import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { PushPayload } from './notification.types';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Suscripciones muertas: el navegador ya no acepta ese endpoint. */
const GONE_STATUS = [404, 410];

/**
 * Web Push es best-effort: sin claves VAPID o sin HTTPS el envio se registra y
 * se ignora, nunca tumba la reserva que lo origino.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID sin configurar: el push queda deshabilitado y solo se envia correo.');
      return;
    }

    webpush.setVapidDetails(
      this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@localhost',
      publicKey,
      privateKey,
    );
    this.publicKey = publicKey;
  }

  get enabled(): boolean {
    return this.publicKey !== null;
  }

  /** La PWA necesita la clave publica para crear la subscription. */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  async subscribe(userId: string, input: PushSubscriptionInput): Promise<{ id: string }> {
    const subscription = await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: { userId, p256dh: input.keys.p256dh, auth: input.keys.auth },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      },
    });

    return { id: subscription.id };
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.enabled || userIds.length === 0) {
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });

    const serialized = JSON.stringify(payload);

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          serialized,
        );
      } catch (error) {
        await this.handleFailure(subscription.id, subscription.endpoint, error);
      }
    }
  }

  private async handleFailure(id: string, endpoint: string, error: unknown): Promise<void> {
    const statusCode = (error as { statusCode?: number }).statusCode;

    if (statusCode && GONE_STATUS.includes(statusCode)) {
      await this.prisma.pushSubscription.delete({ where: { id } }).catch(() => undefined);
      this.logger.log(`Subscription ${endpoint} descartada (${statusCode}).`);
      return;
    }

    this.logger.error(`Fallo el push a ${endpoint}`, error);
  }
}
