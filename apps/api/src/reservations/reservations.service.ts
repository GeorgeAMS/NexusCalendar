import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReservationStatus, UserRole, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  addDays,
  earliestBookableDate,
  minutesOfDay,
  parseDateOnly,
  todayInTimezone,
} from '../common/dates';
import { AppError, ErrorCode } from '../common/error-codes';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, normalizeEmail } from '../users/user.types';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsDto } from './dto/list-reservations.dto';
import {
  ReservationDto,
  ReservationWithRelations,
  reservationInclude,
  toReservationDto,
  toReservationSummary,
} from './reservation.types';

const DEFAULT_WINDOW_DAYS = 30;

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  get timezone(): string {
    return this.config.get<string>('APP_TIMEZONE') ?? 'America/Bogota';
  }

  /**
   * Sin rango explicito devuelve los proximos 30 dias desde hoy.
   * Sin `status` devuelve solo `confirmed`: las canceladas y sobreescritas
   * no ocupan sala y solo interesan como historial.
   */
  async list(query: ListReservationsDto): Promise<{ items: ReservationDto[] }> {
    const from = query.from ?? todayInTimezone(this.timezone);
    const to = query.to ?? addDays(from, DEFAULT_WINDOW_DAYS);

    if (to < from) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'El rango de fechas esta invertido.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const where: Prisma.ReservationWhereInput = {
      meetingDate: { gte: parseDateOnly(from), lte: parseDateOnly(to) },
      status: query.status ?? ReservationStatus.confirmed,
      ...(query.roomId ? { roomId: query.roomId } : {}),
    };

    const reservations = await this.prisma.reservation.findMany({
      where,
      include: reservationInclude,
      orderBy: [{ meetingDate: 'asc' }, { startTime: 'asc' }],
    });

    return { items: reservations.map(toReservationDto) };
  }

  async findById(id: string): Promise<ReservationDto> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: reservationInclude,
    });

    if (!reservation) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Reserva no encontrada.', HttpStatus.NOT_FOUND);
    }

    return toReservationDto(reservation);
  }

  async create(actor: AuthenticatedUser, dto: CreateReservationDto): Promise<ReservationDto> {
    this.assertValidInterval(dto.startTime, dto.endTime);
    this.assertAdvanceNotice(dto.meetingDate);

    if (dto.force && actor.role !== UserRole.gerencia) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Solo gerencia puede sobreescribir un horario ocupado.',
        HttpStatus.FORBIDDEN,
      );
    }

    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room?.isActive) {
      throw new AppError(ErrorCode.NOT_FOUND, 'La sala no existe o esta inactiva.', HttpStatus.NOT_FOUND);
    }

    const meetingDate = parseDateOnly(dto.meetingDate);
    // Regla de negocio: a la misma hora solo puede haber una reunion confirmed
    // en toda la clinica (cualquier sala). Intervalo semiabierto.
    const conflicts = await this.findTimeConflicts(meetingDate, dto.startTime, dto.endTime);

    if (conflicts.length > 0 && !dto.force) {
      const first = conflicts[0];
      throw new AppError(
        ErrorCode.ROOM_CONFLICT,
        `Ya hay una reunion de ${first.startTime} a ${first.endTime} (${first.room.name}) a cargo de ${first.organizer.fullName}. No puede haber otra a la misma hora.`,
        HttpStatus.CONFLICT,
        {
          conflicts: conflicts.map((conflict) => ({
            id: conflict.id,
            title: conflict.title,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
            roomName: conflict.room.name,
            organizerName: conflict.organizer.fullName,
          })),
          canOverride: actor.role === UserRole.gerencia,
        },
      );
    }

    const inviteeEmails = this.normalizeInvitees(dto.inviteeEmails);
    const knownUsers = await this.resolveInviteeUsers(inviteeEmails);

    const created = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          roomId: dto.roomId,
          organizerId: actor.id,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          meetingDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          invitees: {
            create: inviteeEmails.map((email) => ({
              email,
              userId: knownUsers.get(email) ?? null,
            })),
          },
        },
        include: reservationInclude,
      });

      if (conflicts.length > 0) {
        await tx.reservation.updateMany({
          where: { id: { in: conflicts.map((conflict) => conflict.id) } },
          data: {
            status: ReservationStatus.overridden,
            overriddenByReservationId: reservation.id,
          },
        });
      }

      return reservation;
    });

    await this.audit.record({
      action: 'reservation.created',
      entityType: 'reservation',
      entityId: created.id,
      actorId: actor.id,
      metadata: {
        roomId: dto.roomId,
        meetingDate: dto.meetingDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        invitees: inviteeEmails.length,
        forced: conflicts.length > 0,
      },
    });

    if (conflicts.length > 0) {
      await this.registerOverride(actor, created, conflicts);
    }

    await this.notifications.reservationInvite({
      reservationId: created.id,
      reservation: toReservationSummary(created),
      recipients: created.invitees.map((invitee) => ({
        email: invitee.email,
        userId: invitee.userId,
      })),
    });

    return toReservationDto(created);
  }

  async cancel(actor: AuthenticatedUser, id: string): Promise<void> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: reservationInclude,
    });

    if (!reservation) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Reserva no encontrada.', HttpStatus.NOT_FOUND);
    }

    if (reservation.status !== ReservationStatus.confirmed) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'La reserva ya no esta confirmada.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isOrganizer = reservation.organizerId === actor.id;
    if (!isOrganizer && actor.role !== UserRole.gerencia) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Solo el organizador o gerencia pueden cancelar esta reserva.',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.cancelled },
    });

    await this.audit.record({
      action: 'reservation.cancelled',
      entityType: 'reservation',
      entityId: id,
      actorId: actor.id,
      metadata: { byOrganizer: isOrganizer, organizerId: reservation.organizerId },
    });

    const recipients = reservation.invitees.map((invitee) => ({
      email: invitee.email,
      userId: invitee.userId,
    }));

    // Al organizador solo se le avisa si la cancelacion no fue suya.
    if (!isOrganizer) {
      recipients.push({
        email: reservation.organizer.email,
        userId: reservation.organizerId,
      });
    }

    await this.notifications.reservationCancelled({
      reservationId: id,
      reservation: toReservationSummary(reservation),
      cancelledBy: actor.fullName,
      recipients,
    });
  }

  /**
   * Solo una reunion confirmed por franja horaria en toda la clinica.
   * Intervalo semiabierto: una puede empezar justo cuando termina otra.
   */
  private findTimeConflicts(
    meetingDate: Date,
    startTime: string,
    endTime: string,
  ): Promise<ReservationWithRelations[]> {
    return this.prisma.reservation.findMany({
      where: {
        meetingDate,
        status: ReservationStatus.confirmed,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      include: reservationInclude,
      orderBy: [{ startTime: 'asc' }, { room: { name: 'asc' } }],
    });
  }

  private assertValidInterval(startTime: string, endTime: string): void {
    if (minutesOfDay(endTime) <= minutesOfDay(startTime)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'La hora de salida debe ser posterior a la de entrada.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private assertAdvanceNotice(meetingDate: string): void {
    const earliest = earliestBookableDate(this.timezone);

    if (meetingDate < earliest) {
      throw new AppError(
        ErrorCode.ADVANCE_NOTICE,
        `Las reservas se hacen con un dia de anticipacion. La fecha mas cercana disponible es ${earliest}.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
        { earliestDate: earliest },
      );
    }
  }

  private normalizeInvitees(emails: string[] | undefined): string[] {
    return [...new Set((emails ?? []).map(normalizeEmail).filter(Boolean))];
  }

  private async resolveInviteeUsers(emails: string[]): Promise<Map<string, string>> {
    if (emails.length === 0) {
      return new Map();
    }

    const users = await this.prisma.user.findMany({
      where: { email: { in: emails }, status: UserStatus.active },
      select: { id: true, email: true },
    });

    return new Map(users.map((user) => [user.email, user.id]));
  }

  private async registerOverride(
    actor: AuthenticatedUser,
    created: ReservationWithRelations,
    displaced: ReservationWithRelations[],
  ): Promise<void> {
    await this.audit.record({
      action: 'reservation.overridden',
      entityType: 'reservation',
      entityId: created.id,
      actorId: actor.id,
      metadata: {
        overridden: displaced.map((reservation) => ({
          id: reservation.id,
          organizerId: reservation.organizerId,
          title: reservation.title,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
        })),
      },
    });

    for (const reservation of displaced) {
      await this.notifications.reservationOverridden({
        reservationId: reservation.id,
        reservation: toReservationSummary(reservation),
        replacement: toReservationSummary(created),
        takenBy: actor.fullName,
        recipients: [
          { email: reservation.organizer.email, userId: reservation.organizerId },
          ...reservation.invitees.map((invitee) => ({
            email: invitee.email,
            userId: invitee.userId,
          })),
        ],
      });
    }
  }
}
