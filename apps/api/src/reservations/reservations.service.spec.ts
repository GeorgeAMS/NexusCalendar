import { HttpException } from '@nestjs/common';
import { InviteStatus, ReservationStatus, UserRole, UserStatus } from '@prisma/client';
import { addDays, parseDateOnly, todayInTimezone } from '../common/dates';
import { AuthenticatedUser } from '../users/user.types';
import { ReservationWithRelations } from './reservation.types';
import { ReservationsService } from './reservations.service';

const TIMEZONE = 'America/Bogota';
const TODAY = todayInTimezone(TIMEZONE);
const BOOKABLE_DATE = addDays(TODAY, 2);

function buildActor(role: UserRole, overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    fullName: 'Ana Perez',
    email: 'ana@clinica.example',
    phone: '3001234567',
    role,
    status: UserStatus.active,
    approvedAt: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

const organizer = buildActor(UserRole.usuario);
const manager = buildActor(UserRole.gerencia, {
  id: 'manager-1',
  fullName: 'Gabriela Gerente',
  email: 'gerente@clinica.example',
});

function buildReservation(
  overrides: Partial<ReservationWithRelations> = {},
): ReservationWithRelations {
  return {
    id: 'reservation-1',
    roomId: 'room-1',
    organizerId: 'user-1',
    title: 'Comite de calidad',
    description: null,
    meetingDate: parseDateOnly(BOOKABLE_DATE),
    startTime: '10:00',
    endTime: '11:00',
    status: ReservationStatus.confirmed,
    overriddenByReservationId: null,
    createdAt: new Date('2026-08-06T12:00:00Z'),
    updatedAt: new Date('2026-08-06T12:00:00Z'),
    room: {
      id: 'room-1',
      name: 'Sala de juntas Nexus',
      slug: 'sala-juntas-nexus',
      locationNote: null,
      isActive: true,
      createdAt: new Date('2026-08-01T10:00:00Z'),
    },
    organizer: {
      id: 'user-1',
      fullName: 'Ana Perez',
      email: 'ana@clinica.example',
      phone: '3001234567',
      passwordHash: 'hash',
      role: UserRole.usuario,
      status: UserStatus.active,
      approvedById: null,
      approvedAt: null,
      createdAt: new Date('2026-08-01T10:00:00Z'),
      updatedAt: new Date('2026-08-01T10:00:00Z'),
    },
    invitees: [
      {
        id: 'invitee-1',
        reservationId: 'reservation-1',
        email: 'invitado@clinica.example',
        userId: null,
        inviteStatus: InviteStatus.accepted,
        createdAt: new Date('2026-08-06T12:00:00Z'),
      },
    ],
    ...overrides,
  };
}

function expectAppError(error: unknown, code: string, status: number): void {
  expect(error).toBeInstanceOf(HttpException);
  const httpError = error as HttpException;
  expect(httpError.getStatus()).toBe(status);
  expect((httpError.getResponse() as { code: string }).code).toBe(code);
}

const validDraft = {
  roomId: '11111111-1111-4111-8111-111111111111',
  title: 'Reunion de seguimiento',
  meetingDate: BOOKABLE_DATE,
  startTime: '09:00',
  endTime: '10:00',
};

describe('ReservationsService', () => {
  let prisma: {
    reservation: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    room: { findUnique: jest.Mock };
    user: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: { reservation: { create: jest.Mock; updateMany: jest.Mock } };
  let audit: { record: jest.Mock };
  let notifications: {
    reservationInvite: jest.Mock;
    reservationOverridden: jest.Mock;
    reservationCancelled: jest.Mock;
  };
  let service: ReservationsService;

  beforeEach(() => {
    tx = {
      reservation: {
        create: jest.fn().mockResolvedValue(buildReservation({ id: 'reservation-new' })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      room: {
        findUnique: jest.fn().mockResolvedValue(buildReservation().room),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    audit = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = {
      reservationInvite: jest.fn().mockResolvedValue(undefined),
      reservationOverridden: jest.fn().mockResolvedValue(undefined),
      reservationCancelled: jest.fn().mockResolvedValue(undefined),
    };

    const config = { get: () => TIMEZONE };

    service = new ReservationsService(
      prisma as never,
      config as never,
      audit as never,
      notifications as never,
    );
  });

  describe('list', () => {
    it('sin rango usa hoy y los siguientes 30 dias, solo confirmadas', async () => {
      await service.list({});

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            meetingDate: {
              gte: parseDateOnly(TODAY),
              lte: parseDateOnly(addDays(TODAY, 30)),
            },
            status: ReservationStatus.confirmed,
          },
          orderBy: [{ meetingDate: 'asc' }, { startTime: 'asc' }],
        }),
      );
    });

    it('respeta el rango, la sala y el estado pedidos', async () => {
      await service.list({
        from: '2026-08-10',
        to: '2026-08-12',
        roomId: 'room-9',
        status: ReservationStatus.overridden,
      });

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            meetingDate: {
              gte: parseDateOnly('2026-08-10'),
              lte: parseDateOnly('2026-08-12'),
            },
            status: ReservationStatus.overridden,
            roomId: 'room-9',
          },
        }),
      );
    });

    it('rechaza un rango invertido', async () => {
      expect.assertions(3);

      await service
        .list({ from: '2026-08-12', to: '2026-08-10' })
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
    });

    it('aplana sala, organizador e invitados en la respuesta', async () => {
      prisma.reservation.findMany.mockResolvedValue([buildReservation()]);

      const { items } = await service.list({});

      expect(items[0]).toEqual({
        id: 'reservation-1',
        roomId: 'room-1',
        roomName: 'Sala de juntas Nexus',
        organizerId: 'user-1',
        organizerName: 'Ana Perez',
        title: 'Comite de calidad',
        description: null,
        meetingDate: BOOKABLE_DATE,
        startTime: '10:00',
        endTime: '11:00',
        status: ReservationStatus.confirmed,
        invitees: [
          {
            email: 'invitado@clinica.example',
            userId: null,
            inviteStatus: InviteStatus.accepted,
          },
        ],
        createdAt: '2026-08-06T12:00:00.000Z',
      });
    });
  });

  describe('create', () => {
    it('crea la reserva en un horario libre y la audita', async () => {
      await service.create(organizer, validDraft);

      expect(tx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizerId: 'user-1',
            roomId: validDraft.roomId,
            meetingDate: parseDateOnly(BOOKABLE_DATE),
            startTime: '09:00',
            endTime: '10:00',
          }),
        }),
      );
      expect(tx.reservation.updateMany).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reservation.created' }),
      );
    });

    it('deduplica y normaliza los correos de invitados', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-9', email: 'invitado@clinica.example' },
      ]);

      await service.create(organizer, {
        ...validDraft,
        inviteeEmails: [
          'Invitado@Clinica.example',
          'invitado@clinica.example',
          'otro@clinica.example',
        ],
      });

      const data = tx.reservation.create.mock.calls[0][0].data as {
        invitees: { create: { email: string; userId: string | null }[] };
      };

      expect(data.invitees.create).toEqual([
        { email: 'invitado@clinica.example', userId: 'user-9' },
        { email: 'otro@clinica.example', userId: null },
      ]);
    });

    it('invita por correo a los invitados persistidos', async () => {
      await service.create(organizer, { ...validDraft, inviteeEmails: ['invitado@clinica.example'] });

      expect(notifications.reservationInvite).toHaveBeenCalledWith({
        reservationId: 'reservation-new',
        reservation: expect.objectContaining({
          title: 'Comite de calidad',
          roomName: 'Sala de juntas Nexus',
          organizerName: 'Ana Perez',
        }),
        recipients: [{ email: 'invitado@clinica.example', userId: null }],
      });
    });

    it('detecta solapes globales con intervalo semiabierto', async () => {
      await service.create(organizer, validDraft);

      expect(prisma.reservation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            meetingDate: parseDateOnly(BOOKABLE_DATE),
            status: ReservationStatus.confirmed,
            startTime: { lt: '10:00' },
            endTime: { gt: '09:00' },
          },
        }),
      );
    });

    it('devuelve ROOM_CONFLICT con el detalle del choque', async () => {
      prisma.reservation.findMany.mockResolvedValue([buildReservation()]);

      expect.assertions(5);
      await service.create(organizer, validDraft).catch((error: unknown) => {
        expectAppError(error, 'ROOM_CONFLICT', 409);
        const details = (error as HttpException).getResponse() as {
          details: { conflicts: { title: string }[]; canOverride: boolean };
        };
        expect(details.details.conflicts[0].title).toBe('Comite de calidad');
        expect(details.details.canOverride).toBe(false);
      });
    });

    it('marca canOverride cuando quien choca es gerencia', async () => {
      prisma.reservation.findMany.mockResolvedValue([buildReservation()]);

      expect.assertions(4);
      await service.create(manager, validDraft).catch((error: unknown) => {
        expectAppError(error, 'ROOM_CONFLICT', 409);
        const response = (error as HttpException).getResponse() as {
          details: { canOverride: boolean };
        };
        expect(response.details.canOverride).toBe(true);
      });
    });

    it('bloquea otra reunion a la misma hora aunque sea otra sala', async () => {
      const otherRoom = buildReservation({
        id: 'reservation-other',
        roomId: 'room-2',
        room: {
          ...buildReservation().room,
          id: 'room-2',
          name: 'Sala B',
          slug: 'sala-b',
        },
        startTime: '09:00',
        endTime: '10:00',
      });
      prisma.reservation.findMany.mockResolvedValue([otherRoom]);

      expect.assertions(4);
      await service.create(organizer, validDraft).catch((error: unknown) => {
        expectAppError(error, 'ROOM_CONFLICT', 409);
        const details = (error as HttpException).getResponse() as {
          details: { conflicts: { roomName: string }[] };
        };
        expect(details.details.conflicts[0].roomName).toBe('Sala B');
      });
    });

    it('un usuario general no puede forzar', async () => {
      expect.assertions(3);

      await service
        .create(organizer, { ...validDraft, force: true })
        .catch((error: unknown) => expectAppError(error, 'FORBIDDEN', 403));
    });

    it('gerencia con force sobreescribe, audita y avisa a los desplazados', async () => {
      const displaced = buildReservation();
      prisma.reservation.findMany.mockResolvedValue([displaced]);

      await service.create(manager, { ...validDraft, force: true });

      expect(tx.reservation.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['reservation-1'] } },
        data: {
          status: ReservationStatus.overridden,
          overriddenByReservationId: 'reservation-new',
        },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reservation.overridden' }),
      );
      expect(notifications.reservationOverridden).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: 'reservation-1',
          takenBy: 'Gabriela Gerente',
          recipients: [
            { email: 'ana@clinica.example', userId: 'user-1' },
            { email: 'invitado@clinica.example', userId: null },
          ],
        }),
      );
    });

    it('exige que la salida sea posterior a la entrada', async () => {
      expect.assertions(3);

      await service
        .create(organizer, { ...validDraft, startTime: '10:00', endTime: '10:00' })
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
    });

    it.each([
      ['hoy', TODAY],
      ['ayer', addDays(TODAY, -1)],
    ])('rechaza reservar para %s con ADVANCE_NOTICE', async (_label, meetingDate) => {
      expect.assertions(3);

      await service
        .create(organizer, { ...validDraft, meetingDate })
        .catch((error: unknown) => expectAppError(error, 'ADVANCE_NOTICE', 422));
    });

    it('acepta la primera fecha disponible: manana', async () => {
      await expect(
        service.create(organizer, { ...validDraft, meetingDate: addDays(TODAY, 1) }),
      ).resolves.toBeDefined();
    });

    it('rechaza una sala inactiva', async () => {
      prisma.room.findUnique.mockResolvedValue({
        ...buildReservation().room,
        isActive: false,
      });

      expect.assertions(3);
      await service
        .create(organizer, validDraft)
        .catch((error: unknown) => expectAppError(error, 'NOT_FOUND', 404));
    });
  });

  describe('cancel', () => {
    it('el organizador cancela su propia reserva', async () => {
      prisma.reservation.findUnique.mockResolvedValue(buildReservation());

      await service.cancel(organizer, 'reservation-1');

      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: 'reservation-1' },
        data: { status: ReservationStatus.cancelled },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reservation.cancelled',
          metadata: expect.objectContaining({ byOrganizer: true }),
        }),
      );
    });

    it('avisa a los invitados, no al organizador que cancelo', async () => {
      prisma.reservation.findUnique.mockResolvedValue(buildReservation());

      await service.cancel(organizer, 'reservation-1');

      expect(notifications.reservationCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelledBy: 'Ana Perez',
          recipients: [{ email: 'invitado@clinica.example', userId: null }],
        }),
      );
    });

    it('gerencia puede cancelar una reserva ajena', async () => {
      prisma.reservation.findUnique.mockResolvedValue(buildReservation());

      await service.cancel(manager, 'reservation-1');

      expect(prisma.reservation.update).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ byOrganizer: false }) }),
      );
    });

    it('si cancela gerencia, el organizador tambien se entera', async () => {
      prisma.reservation.findUnique.mockResolvedValue(buildReservation());

      await service.cancel(manager, 'reservation-1');

      expect(notifications.reservationCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelledBy: 'Gabriela Gerente',
          recipients: [
            { email: 'invitado@clinica.example', userId: null },
            { email: 'ana@clinica.example', userId: 'user-1' },
          ],
        }),
      );
    });

    it('un usuario general no cancela reservas ajenas', async () => {
      prisma.reservation.findUnique.mockResolvedValue(
        buildReservation({ organizerId: 'otro-usuario' }),
      );

      expect.assertions(4);
      await service
        .cancel(organizer, 'reservation-1')
        .catch((error: unknown) => expectAppError(error, 'FORBIDDEN', 403));
      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('no cancela dos veces', async () => {
      prisma.reservation.findUnique.mockResolvedValue(
        buildReservation({ status: ReservationStatus.cancelled }),
      );

      expect.assertions(3);
      await service
        .cancel(organizer, 'reservation-1')
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
    });

    it('devuelve NOT_FOUND si no existe', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      expect.assertions(3);
      await service
        .cancel(organizer, 'reservation-1')
        .catch((error: unknown) => expectAppError(error, 'NOT_FOUND', 404));
    });
  });

  describe('findById', () => {
    it('devuelve NOT_FOUND si no existe', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      expect.assertions(3);
      await service
        .findById('reservation-1')
        .catch((error: unknown) => expectAppError(error, 'NOT_FOUND', 404));
    });

    it('devuelve el detalle mapeado', async () => {
      prisma.reservation.findUnique.mockResolvedValue(buildReservation());

      const reservation = await service.findById('reservation-1');

      expect(reservation.roomName).toBe('Sala de juntas Nexus');
      expect(reservation.meetingDate).toBe(BOOKABLE_DATE);
    });
  });
});
