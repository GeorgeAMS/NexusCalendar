import { InviteStatus, Prisma, ReservationStatus } from '@prisma/client';
import { formatDateOnly } from '../common/dates';
import { ReservationSummary } from '../notifications/templates';

export const reservationInclude = {
  room: true,
  organizer: true,
  invitees: { orderBy: { email: 'asc' } },
} satisfies Prisma.ReservationInclude;

export type ReservationWithRelations = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

export interface ReservationInviteeDto {
  email: string;
  userId: string | null;
  inviteStatus: InviteStatus;
}

export interface ReservationDto {
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
  invitees: ReservationInviteeDto[];
  createdAt: string;
}

/** Datos que necesitan las plantillas de correo y push. */
export function toReservationSummary(reservation: ReservationWithRelations): ReservationSummary {
  return {
    title: reservation.title,
    description: reservation.description,
    roomName: reservation.room.name,
    meetingDate: formatDateOnly(reservation.meetingDate),
    startTime: reservation.startTime,
    endTime: reservation.endTime,
    organizerName: reservation.organizer.fullName,
  };
}

export function toReservationDto(reservation: ReservationWithRelations): ReservationDto {
  return {
    id: reservation.id,
    roomId: reservation.roomId,
    roomName: reservation.room.name,
    organizerId: reservation.organizerId,
    organizerName: reservation.organizer.fullName,
    title: reservation.title,
    description: reservation.description,
    meetingDate: formatDateOnly(reservation.meetingDate),
    startTime: reservation.startTime,
    endTime: reservation.endTime,
    status: reservation.status,
    invitees: reservation.invitees.map((invitee) => ({
      email: invitee.email,
      userId: invitee.userId,
      inviteStatus: invitee.inviteStatus,
    })),
    createdAt: reservation.createdAt.toISOString(),
  };
}
