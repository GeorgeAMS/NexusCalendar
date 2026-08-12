import { UserRole } from '@prisma/client';
import { formatSpanishDate } from '../common/dates';
import { NotificationMessage } from './notification.types';

const SIGNATURE = 'Clinica Regional del San Jorge';
const TIMEZONE = 'America/Bogota';

/** Azul institucional + naranja de accion (alineado al PWA). */
const BRAND = {
  navy: '#0b1f3a',
  navyDeep: '#071526',
  orange: '#e85d04',
  orangeSoft: '#fff4ec',
  slate: '#334155',
  muted: '#64748b',
  line: '#e2e8f0',
  paper: '#ffffff',
  mist: '#f1f5f9',
  success: '#0f766e',
  danger: '#b91c1c',
};

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

function calendarUrl(webUrl: string): string {
  return `${webUrl.replace(/\/$/, '')}/calendario`;
}

function logoUrl(webUrl: string): string {
  return `${webUrl.replace(/\/$/, '')}/brand/nexus-logo-transparent.png`;
}

function lines(...parts: (string | null | undefined)[]): string {
  return parts.filter((part) => part !== null && part !== undefined).join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Link "Agregar a Google Calendar" (hora local America/Bogota). */
export function googleCalendarUrl(
  reservation: ReservationSummary,
  webUrl: string,
): string {
  const day = reservation.meetingDate.replace(/-/g, '');
  const start = `${reservation.startTime.replace(':', '')}00`;
  const end = `${reservation.endTime.replace(':', '')}00`;
  const details = [
    reservation.description?.trim() || null,
    `Organizador: ${reservation.organizerName}`,
    `Sala: ${reservation.roomName}`,
    `Ver en Nexus Calendar: ${calendarUrl(webUrl)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: reservation.title,
    dates: `${day}T${start}/${day}T${end}`,
    ctz: TIMEZONE,
    details,
    location: reservation.roomName,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Bloque de datos de reunion en texto plano. */
export function meetingBlockText(
  reservation: ReservationSummary,
  extras: { label: string; value: string }[] = [],
): string {
  const rows = [
    `Reunion: ${reservation.title}`,
    `Sala: ${reservation.roomName}`,
    `Fecha: ${formatSpanishDate(reservation.meetingDate)}`,
    `Horario: ${reservation.startTime} a ${reservation.endTime}`,
    `Organizador: ${reservation.organizerName}`,
    ...extras.map((extra) => `${extra.label}: ${extra.value}`),
    reservation.description ? `Detalle: ${reservation.description}` : null,
  ];
  return lines(...rows);
}

/** Tarjeta visual de la reunion. */
export function meetingBlockHtml(
  reservation: ReservationSummary,
  extras: { label: string; value: string }[] = [],
): string {
  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};width:118px;vertical-align:top;">
        <span style="display:inline-block;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.muted};font-weight:700;">${escapeHtml(label)}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid ${BRAND.line};vertical-align:top;">
        <span style="font-size:15px;line-height:1.45;color:${BRAND.navy};font-weight:600;">${escapeHtml(value)}</span>
      </td>
    </tr>`;

  const extraRows = extras.map((extra) => row(extra.label, extra.value)).join('');
  const detailRow = reservation.description
    ? row('Detalle', reservation.description)
    : '';

  return `
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0 8px;border-collapse:separate;background:${BRAND.paper};border:1px solid ${BRAND.line};border-radius:16px;overflow:hidden;">
  <tr>
    <td style="width:6px;background:${BRAND.orange};font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding:18px 20px 8px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.orange};font-weight:700;">Detalle de la reunion</p>
      <p style="margin:0 0 14px;font-size:22px;line-height:1.25;color:${BRAND.navy};font-weight:700;">${escapeHtml(reservation.title)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        <tbody>
          ${row('Sala', reservation.roomName)}
          ${row('Fecha', formatSpanishDate(reservation.meetingDate))}
          ${row('Horario', `${reservation.startTime} – ${reservation.endTime}`)}
          ${row('Organizador', reservation.organizerName)}
          ${extraRows}
          ${detailRow}
        </tbody>
      </table>
      <p style="margin:14px 0 6px;font-size:12px;color:${BRAND.muted};">Zona horaria: ${TIMEZONE}</p>
    </td>
  </tr>
</table>`;
}

type EmailTone = 'invite' | 'cancel' | 'override' | 'success';

const TONE_BAR: Record<EmailTone, string> = {
  invite: BRAND.orange,
  cancel: BRAND.danger,
  override: '#c2410c',
  success: BRAND.success,
};

function ctaButton(url: string, label: string, variant: 'primary' | 'secondary'): string {
  if (variant === 'primary') {
    return `<a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND.orange};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.02em;padding:14px 22px;border-radius:999px;border:2px solid ${BRAND.orange};">${escapeHtml(label)}</a>`;
  }
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND.paper};color:${BRAND.navy};text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.02em;padding:14px 22px;border-radius:999px;border:2px solid ${BRAND.line};">${escapeHtml(label)}</a>`;
}

function emailShellHtml(input: {
  webUrl: string;
  heading: string;
  eyebrow?: string;
  introHtml: string;
  meetingHtml: string;
  primaryCta: { url: string; label: string };
  secondaryCta?: { url: string; label: string };
  tone?: EmailTone;
}): string {
  const tone = input.tone ?? 'invite';
  const bar = TONE_BAR[tone];
  const logo = logoUrl(input.webUrl);
  const secondary = input.secondaryCta
    ? `<td style="padding:0 0 0 10px;">${ctaButton(input.secondaryCta.url, input.secondaryCta.label, 'secondary')}</td>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.navyDeep};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(input.heading)} — Nexus Calendar
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg, ${BRAND.navyDeep} 0%, ${BRAND.navy} 100%);background-color:${BRAND.navyDeep};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:separate;">
          <tr>
            <td style="background:${BRAND.paper};border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,0.28);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height:5px;background:${bar};font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td align="center" style="padding:22px 28px 0;background:${BRAND.mist};">
                    <img src="${escapeHtml(logo)}" width="156" alt="Nexus Calendar" style="display:block;width:156px;max-width:52%;height:auto;border:0;outline:none;text-decoration:none;background:transparent;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 28px 8px;background:${BRAND.mist};">
                    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:${BRAND.muted};font-weight:700;">${escapeHtml(input.eyebrow ?? 'Nexus Calendar')}</p>
                    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:${BRAND.navy};font-weight:700;">${escapeHtml(input.heading)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:22px 28px 28px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.slate};font-size:15px;line-height:1.55;">
                    ${input.introHtml}
                    ${input.meetingHtml}
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;border-collapse:collapse;">
                      <tr>
                        <td>${ctaButton(input.primaryCta.url, input.primaryCta.label, 'primary')}</td>
                        ${secondary}
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px;background:${BRAND.navy};">
                    <p style="margin:0;font-size:13px;color:#cbd5e1;line-height:1.5;">
                      <strong style="color:#ffffff;">${escapeHtml(SIGNATURE)}</strong><br />
                      Reservas de salas · Nexus Calendar
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:18px 12px 0;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#94a3b8;">
                Recibiste este mensaje porque participas en una reunion de Nexus Calendar.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function accountApprovedTemplate(input: {
  fullName: string;
  role: UserRole;
  webUrl: string;
}): NotificationMessage {
  const role = ROLE_LABEL[input.role];
  const url = calendarUrl(input.webUrl);

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
    html: emailShellHtml({
      webUrl: input.webUrl,
      tone: 'success',
      eyebrow: 'Bienvenido',
      heading: 'Tu cuenta ya esta activa',
      introHtml: `<p style="margin:0 0 10px;">Hola <strong style="color:${BRAND.navy};">${escapeHtml(input.fullName)}</strong>,</p>
        <p style="margin:0;">Tu cuenta fue aprobada con el rol de <strong style="color:${BRAND.navy};">${escapeHtml(role)}</strong>. Ya puedes iniciar sesion y reservar salas (con un dia de anticipacion).</p>`,
      meetingHtml: '',
      primaryCta: { url, label: 'Abrir Nexus Calendar' },
    }),
  };
}

export function reservationInviteTemplate(input: {
  reservation: ReservationSummary;
  webUrl: string;
}): NotificationMessage {
  const { reservation } = input;
  const url = calendarUrl(input.webUrl);
  const gcal = googleCalendarUrl(reservation, input.webUrl);

  return {
    subject: `Invitacion: ${reservation.title} — ${formatSpanishDate(reservation.meetingDate)}`,
    title: 'Nueva reunion en tu calendario',
    body: `${reservation.title} · ${reservation.roomName} · ${when(reservation)}`,
    text: lines(
      `${reservation.organizerName} te invito a una reunion.`,
      '',
      meetingBlockText(reservation),
      '',
      `Ver en Nexus Calendar: ${url}`,
      `Guardar en Google Calendar: ${gcal}`,
      '',
      SIGNATURE,
    ),
    html: emailShellHtml({
      webUrl: input.webUrl,
      tone: 'invite',
      eyebrow: 'Invitacion',
      heading: 'Te esperamos en una reunion',
      introHtml: `<p style="margin:0;"><strong style="color:${BRAND.navy};">${escapeHtml(reservation.organizerName)}</strong> te invito a una reunion en Nexus Calendar.</p>`,
      meetingHtml: meetingBlockHtml(reservation),
      primaryCta: { url, label: 'Ver en Nexus Calendar' },
      secondaryCta: { url: gcal, label: 'Guardar en Google Calendar' },
    }),
  };
}

export function reservationOverriddenTemplate(input: {
  reservation: ReservationSummary;
  replacement: ReservationSummary;
  takenBy: string;
  webUrl: string;
}): NotificationMessage {
  const { reservation, replacement } = input;
  const url = calendarUrl(input.webUrl);

  return {
    subject: `Tu reunion "${reservation.title}" fue reprogramada por gerencia`,
    title: 'Sala reasignada por gerencia',
    body: `${reservation.title} perdio ${reservation.roomName} el ${formatSpanishDate(reservation.meetingDate)}.`,
    text: lines(
      `La reunion "${reservation.title}" del ${when(reservation)}`,
      `en ${reservation.roomName} fue reemplazada por una reserva de gerencia.`,
      '',
      meetingBlockText(reservation, [{ label: 'Tomada por', value: input.takenBy }]),
      '',
      `Nueva reunion en esa sala: "${replacement.title}" de ${replacement.startTime} a ${replacement.endTime}.`,
      '',
      `Puedes reprogramar en ${url}.`,
      '',
      SIGNATURE,
    ),
    html: emailShellHtml({
      webUrl: input.webUrl,
      tone: 'override',
      eyebrow: 'Aviso de gerencia',
      heading: 'Tu sala fue reasignada',
      introHtml: `<p style="margin:0 0 10px;">Tu reunion fue reemplazada por una reserva de gerencia.</p>
        <p style="margin:0;padding:12px 14px;background:${BRAND.orangeSoft};border-radius:12px;border:1px solid #ffd7bf;">
          Nueva reunion en esa sala: <strong style="color:${BRAND.navy};">${escapeHtml(replacement.title)}</strong>
          de ${escapeHtml(replacement.startTime)} a ${escapeHtml(replacement.endTime)}.
        </p>`,
      meetingHtml: meetingBlockHtml(reservation, [
        { label: 'Tomada por', value: input.takenBy },
      ]),
      primaryCta: { url, label: 'Reprogramar en Nexus' },
    }),
  };
}

export function reservationCancelledTemplate(input: {
  reservation: ReservationSummary;
  cancelledBy: string;
  webUrl: string;
}): NotificationMessage {
  const { reservation } = input;
  const url = calendarUrl(input.webUrl);

  return {
    subject: `Cancelada: ${reservation.title} — ${formatSpanishDate(reservation.meetingDate)}`,
    title: 'Reunion cancelada',
    body: `${reservation.title} del ${formatSpanishDate(reservation.meetingDate)} ya no se realizara.`,
    text: lines(
      `La reunion "${reservation.title}" fue cancelada.`,
      '',
      meetingBlockText(reservation, [
        { label: 'Cancelada por', value: input.cancelledBy },
      ]),
      '',
      `La sala queda libre en ${url}.`,
      '',
      SIGNATURE,
    ),
    html: emailShellHtml({
      webUrl: input.webUrl,
      tone: 'cancel',
      eyebrow: 'Cancelacion',
      heading: 'La reunion ya no se realizara',
      introHtml: `<p style="margin:0;">La reunion <strong style="color:${BRAND.navy};">${escapeHtml(reservation.title)}</strong> fue cancelada. La sala queda libre para nuevas reservas.</p>`,
      meetingHtml: meetingBlockHtml(reservation, [
        { label: 'Cancelada por', value: input.cancelledBy },
      ]),
      primaryCta: { url, label: 'Ver calendario' },
    }),
  };
}
