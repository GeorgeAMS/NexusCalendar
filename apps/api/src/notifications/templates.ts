import { UserRole } from '@prisma/client';
import { formatSpanishDate } from '../common/dates';
import { NotificationMessage } from './notification.types';

const SIGNATURE = 'Clinica Regional del San Jorge';

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  gerencia: 'Gerencia',
  usuario: 'Usuario general',
};

export interface ReservationSummary {
  title: string;
  description?: string | null;
  roomName: string;
  meetingDate: string;
  startTime: string;
  endTime: string;
  organizerName: string;
}

function when(reservation: ReservationSummary): string {
  return `${formatSpanishDate(reservation.meetingDate)}, ${reservation.startTime} a ${reservation.endTime}`;
}

function lines(...parts: (string | null | undefined)[]): string {
  return parts.filter((part) => part !== null && part !== undefined).join('\n');
}

export function accountApprovedTemplate(input: {
  fullName: string;
  role: UserRole;
  webUrl: string;
}): NotificationMessage {
  const role = ROLE_LABEL[input.role];

  return {
    subject: 'Tu cuenta de Nexus Calendar ya esta activa',
    title: 'Cuenta aprobada',
    body: `Ya puedes reservar salas con el rol de ${role}.`,
    text: lines(
      `Hola ${input.fullName},`,
      '',
      `Tu cuenta de Nexus Calendar fue aprobada con el rol de ${role}.`,
      `Ya puedes iniciar sesion en ${input.webUrl} y reservar salas de reunion.`,
      '',
      'Recuerda que las reservas se hacen con un dia de anticipacion.',
      '',
      SIGNATURE,
    ),
  };
}

export function reservationInviteTemplate(input: {
  reservation: ReservationSummary;
  webUrl: string;
}): NotificationMessage {
  const { reservation } = input;

  return {
    subject: `Invitacion: ${reservation.title} — ${formatSpanishDate(reservation.meetingDate)}`,
    title: 'Nueva reunion en tu calendario',
    body: `${reservation.title} · ${reservation.roomName} · ${when(reservation)}`,
    text: lines(
      `${reservation.organizerName} te invito a una reunion.`,
      '',
      `Reunion: ${reservation.title}`,
      `Sala: ${reservation.roomName}`,
      `Cuando: ${when(reservation)}`,
      reservation.description ? `Detalle: ${reservation.description}` : null,
      '',
      `Puedes verla en ${input.webUrl}.`,
      '',
      SIGNATURE,
    ),
  };
}

export function reservationOverriddenTemplate(input: {
  reservation: ReservationSummary;
  replacement: ReservationSummary;
  takenBy: string;
  webUrl: string;
}): NotificationMessage {
  const { reservation, replacement } = input;

  return {
    subject: `Tu reunion "${reservation.title}" fue reprogramada por gerencia`,
    title: 'Sala reasignada por gerencia',
    body: `${reservation.title} perdio ${reservation.roomName} el ${formatSpanishDate(reservation.meetingDate)}.`,
    text: lines(
      `La reunion "${reservation.title}" del ${when(reservation)}`,
      `en ${reservation.roomName} fue reemplazada por una reserva de gerencia.`,
      '',
      `Tomada por: ${input.takenBy}`,
      `Nueva reunion en esa sala: "${replacement.title}" de ${replacement.startTime} a ${replacement.endTime}.`,
      '',
      `Puedes reprogramar en ${input.webUrl}.`,
      '',
      SIGNATURE,
    ),
  };
}

export function reservationCancelledTemplate(input: {
  reservation: ReservationSummary;
  cancelledBy: string;
  webUrl: string;
}): NotificationMessage {
  const { reservation } = input;

  return {
    subject: `Cancelada: ${reservation.title} — ${formatSpanishDate(reservation.meetingDate)}`,
    title: 'Reunion cancelada',
    body: `${reservation.title} del ${formatSpanishDate(reservation.meetingDate)} ya no se realizara.`,
    text: lines(
      `La reunion "${reservation.title}" fue cancelada.`,
      '',
      `Sala: ${reservation.roomName}`,
      `Cuando iba a ser: ${when(reservation)}`,
      `Cancelada por: ${input.cancelledBy}`,
      '',
      `La sala queda libre en ${input.webUrl}.`,
      '',
      SIGNATURE,
    ),
  };
}
