import { UserRole } from '@prisma/client';
import {
  ReservationSummary,
  accountApprovedTemplate,
  reservationCancelledTemplate,
  reservationInviteTemplate,
  reservationOverriddenTemplate,
} from './templates';

const WEB_URL = 'http://localhost:5173';

const reservation: ReservationSummary = {
  title: 'Comite de calidad',
  description: 'Revision de indicadores.',
  roomName: 'Sala de juntas Nexus',
  meetingDate: '2026-08-07',
  startTime: '08:00',
  endTime: '09:00',
  organizerName: 'Ana Perez',
};

describe('plantillas de notificacion', () => {
  it('la cuenta aprobada nombra el rol en lenguaje de la clinica', () => {
    const message = accountApprovedTemplate({
      fullName: 'Ana Perez',
      role: UserRole.gerencia,
      webUrl: WEB_URL,
    });

    expect(message.text).toContain('Hola Ana Perez');
    expect(message.text).toContain('rol de Gerencia');
    expect(message.text).toContain(WEB_URL);
    expect(message.body).toContain('Gerencia');
  });

  it('la invitacion trae sala, fecha legible y horario', () => {
    const message = reservationInviteTemplate({ reservation, webUrl: WEB_URL });

    expect(message.subject).toContain('Comite de calidad');
    expect(message.subject).toContain('7 de agosto de 2026');
    expect(message.text).toContain('Ana Perez te invito');
    expect(message.text).toContain('Sala: Sala de juntas Nexus');
    expect(message.text).toContain('08:00 a 09:00');
    expect(message.text).toContain('Detalle: Revision de indicadores.');
  });

  it('la invitacion omite el detalle cuando no hay descripcion', () => {
    const message = reservationInviteTemplate({
      reservation: { ...reservation, description: null },
      webUrl: WEB_URL,
    });

    expect(message.text).not.toContain('Detalle:');
  });

  it('el override explica quien tomo la sala y con que reunion', () => {
    const message = reservationOverriddenTemplate({
      reservation,
      replacement: { ...reservation, title: 'Reunion de gerencia', startTime: '08:30', endTime: '09:00' },
      takenBy: 'Gabriela Gerente',
      webUrl: WEB_URL,
    });

    expect(message.subject).toContain('fue reprogramada por gerencia');
    expect(message.text).toContain('Tomada por: Gabriela Gerente');
    expect(message.text).toContain('"Reunion de gerencia" de 08:30 a 09:00');
  });

  it('la cancelacion dice quien cancelo y cuando iba a ser', () => {
    const message = reservationCancelledTemplate({
      reservation,
      cancelledBy: 'Gabriela Gerente',
      webUrl: WEB_URL,
    });

    expect(message.subject).toContain('Cancelada: Comite de calidad');
    expect(message.text).toContain('Cancelada por: Gabriela Gerente');
    expect(message.text).toContain('08:00 a 09:00');
  });

  it('todas firman como la clinica y caben en un push', () => {
    const messages = [
      accountApprovedTemplate({ fullName: 'Ana', role: UserRole.usuario, webUrl: WEB_URL }),
      reservationInviteTemplate({ reservation, webUrl: WEB_URL }),
      reservationCancelledTemplate({ reservation, cancelledBy: 'Ana', webUrl: WEB_URL }),
    ];

    for (const message of messages) {
      expect(message.text).toContain('Clinica Regional del San Jorge');
      expect(message.title.length).toBeLessThanOrEqual(60);
      expect(message.body.length).toBeLessThanOrEqual(140);
    }
  });
});
