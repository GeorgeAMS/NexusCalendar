import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InboxItem, NotificationMessage, NotificationPayload, NotificationType } from './notification.types';

const DEFAULT_LIMIT = 30;

/** Historial in-app: lo que el usuario ve dentro de la PWA sin depender del push. */
@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    userIds: string[],
    type: NotificationType,
    message: NotificationMessage,
    payload: NotificationPayload = {},
  ): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title: message.title,
        body: message.body,
        payload: payload as Prisma.InputJsonObject,
      })),
    });
  }

  async list(
    userId: string,
    options: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<{ items: InboxItem[]; unread: number }> {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, ...(options.unreadOnly ? { readAt: null } : {}) },
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? DEFAULT_LIMIT,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        payload: row.payload,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      unread,
    };
  }

  /** Sin `ids` marca todo el buzon del usuario. */
  async markRead(userId: string, ids?: string[]): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids && ids.length > 0 ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }
}
