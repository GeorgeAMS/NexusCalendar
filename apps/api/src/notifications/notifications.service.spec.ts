import { UserRole } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { ReservationSummary } from './templates';

const reservation: ReservationSummary = {
  title: 'Comite de calidad',
  description: 'Revision de indicadores.',
  roomName: 'Sala de juntas Nexus',
  meetingDate: '2026-08-07',
  startTime: '08:00',
  endTime: '09:00',
  organizerName: 'Ana Perez',
};

/** La entrega va en background; dejamos que el microtask de deliver termine. */
async function flushNotifications(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('NotificationsService', () => {
  let mailer: { send: jest.Mock };
  let push: { sendToUsers: jest.Mock };
  let inbox: { record: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    mailer = { send: jest.fn().mockResolvedValue(undefined) };
    push = { sendToUsers: jest.fn().mockResolvedValue(undefined) };
    inbox = { record: jest.fn().mockResolvedValue(undefined) };

    const config = {
      get: (key: string) => (key === 'APP_WEB_URL' ? 'http://localhost:5173' : undefined),
    };

    service = new NotificationsService(
      mailer as never,
      push as never,
      inbox as never,
      config as never,
    );
  });

  it('manda correo, historial y push a un invitado con cuenta', async () => {
    service.reservationInvite({
      reservationId: 'reservation-1',
      reservation,
      recipients: [{ email: 'invitado@clinica.example', userId: 'user-9' }],
    });
    await flushNotifications();

    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitado@clinica.example',
        subject: expect.stringContaining('Comite de calidad'),
      }),
    );
    expect(inbox.record).toHaveBeenCalledWith(
      ['user-9'],
      'reservation.invite',
      expect.objectContaining({ title: 'Nueva reunion en tu calendario' }),
      { reservationId: 'reservation-1' },
    );
    expect(push.sendToUsers).toHaveBeenCalledWith(
      ['user-9'],
      expect.objectContaining({
        tag: 'reservation-reservation-1',
        renotify: true,
        data: { reservationId: 'reservation-1', type: 'reservation.invite' },
      }),
    );
  });

  it('a un invitado externo solo le llega correo', async () => {
    service.reservationInvite({
      reservationId: 'reservation-1',
      reservation,
      recipients: [{ email: 'externo@otra.example', userId: null }],
    });
    await flushNotifications();

    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(inbox.record).not.toHaveBeenCalled();
    expect(push.sendToUsers).not.toHaveBeenCalled();
  });

  it('deduplica destinatarios repetidos y conserva el userId conocido', async () => {
    service.reservationCancelled({
      reservationId: 'reservation-1',
      reservation,
      cancelledBy: 'Gabriela Gerente',
      recipients: [
        { email: 'Ana@Clinica.example', userId: null },
        { email: 'ana@clinica.example', userId: 'user-1' },
      ],
    });
    await flushNotifications();

    expect(mailer.send).toHaveBeenCalledTimes(1);
    expect(mailer.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@clinica.example' }),
    );
    expect(inbox.record).toHaveBeenCalledWith(
      ['user-1'],
      'reservation.cancelled',
      expect.anything(),
      { reservationId: 'reservation-1' },
    );
  });

  it('sin destinatarios no toca ningun canal', async () => {
    service.reservationInvite({
      reservationId: 'reservation-1',
      reservation,
      recipients: [],
    });
    await flushNotifications();

    expect(mailer.send).not.toHaveBeenCalled();
    expect(inbox.record).not.toHaveBeenCalled();
    expect(push.sendToUsers).not.toHaveBeenCalled();
  });

  it('un fallo de SMTP no interrumpe el resto de canales ni propaga el error', async () => {
    mailer.send.mockRejectedValue(new Error('SMTP caido'));

    expect(() =>
      service.accountApproved({
        userId: 'user-1',
        fullName: 'Ana Perez',
        email: 'ana@clinica.example',
        role: UserRole.usuario,
      }),
    ).not.toThrow();
    await flushNotifications();

    expect(inbox.record).toHaveBeenCalled();
    expect(push.sendToUsers).toHaveBeenCalled();
  });

  it('un fallo de push no propaga el error', async () => {
    push.sendToUsers.mockRejectedValue(new Error('VAPID invalido'));

    expect(() =>
      service.reservationOverridden({
        reservationId: 'reservation-1',
        reservation,
        replacement: { ...reservation, title: 'Reunion de gerencia', startTime: '08:30' },
        takenBy: 'Gabriela Gerente',
        recipients: [{ email: 'ana@clinica.example', userId: 'user-1' }],
      }),
    ).not.toThrow();
    await flushNotifications();

    expect(mailer.send).toHaveBeenCalled();
  });
});
