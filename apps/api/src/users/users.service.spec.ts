import { HttpException } from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma/client';
import { AuthenticatedUser } from './user.types';
import { UsersService } from './users.service';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    fullName: 'Ana Perez',
    email: 'ana@clinica.example',
    phone: '3001234567',
    passwordHash: 'hash',
    role: null,
    status: UserStatus.pending,
    approvedById: null,
    approvedAt: null,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date('2026-08-01T10:00:00Z'),
    ...overrides,
  };
}

const admin: AuthenticatedUser = {
  id: 'admin-1',
  fullName: 'Administrador Nexus',
  email: 'admin@nexus.local',
  phone: '3000000000',
  role: UserRole.admin,
  status: UserStatus.active,
  approvedAt: null,
  createdAt: '2026-08-01T10:00:00.000Z',
};

function expectAppError(error: unknown, code: string, status: number): void {
  expect(error).toBeInstanceOf(HttpException);
  const httpError = error as HttpException;
  expect(httpError.getStatus()).toBe(status);
  expect((httpError.getResponse() as { code: string }).code).toBe(code);
}

describe('UsersService', () => {
  let prisma: {
    user: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    pushSubscription: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let notifications: { accountApproved: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      pushSubscription: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    notifications = { accountApproved: jest.fn().mockResolvedValue(undefined) };

    service = new UsersService(prisma as never, audit as never, notifications as never);
  });

  describe('list', () => {
    it('pagina, ordena por estado y busca por nombre o correo', async () => {
      prisma.user.findMany.mockResolvedValue([buildUser()]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.list({ q: 'ana', page: 2, pageSize: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          where: {
            OR: [
              { fullName: { contains: 'ana', mode: 'insensitive' } },
              { email: { contains: 'ana', mode: 'insensitive' } },
            ],
          },
        }),
      );
      expect(result).toEqual({ items: [expect.any(Object)], total: 1, page: 2, pageSize: 10 });
      expect(result.items[0]).not.toHaveProperty('passwordHash');
    });

    it('usa pagina 1 y 20 por defecto', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const result = await service.list({});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, where: {} }),
      );
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('createByAdmin', () => {
    const dto = {
      fullName: '  Contabilidad  ',
      email: 'Contabilidad@Clinica.Example',
      phone: '3001112233',
      password: 'Nexus123*',
      role: UserRole.usuario,
    };

    it('crea la cuenta activa, hashea password, audita y no expone el hash', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Partial<User> }) =>
        Promise.resolve(
          buildUser({
            ...data,
            id: 'user-new',
            role: UserRole.usuario,
            status: UserStatus.active,
            approvedById: admin.id,
            approvedAt: new Date(),
          }),
        ),
      );

      const result = await service.createByAdmin(admin, dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'contabilidad@clinica.example',
            fullName: 'Contabilidad',
            role: UserRole.usuario,
            status: UserStatus.active,
            approvedById: 'admin-1',
          }),
        }),
      );
      const created = prisma.user.create.mock.calls[0][0].data as { passwordHash: string };
      expect(created.passwordHash).not.toBe(dto.password);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.status).toBe(UserStatus.active);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.created_by_admin', actorId: 'admin-1' }),
      );
    });

    it('rechaza correos duplicados con EMAIL_TAKEN', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      expect.assertions(4);
      await service
        .createByAdmin(admin, dto)
        .catch((error: unknown) => expectAppError(error, 'EMAIL_TAKEN', 409));
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('no permite crear un administrador', async () => {
      expect.assertions(4);
      await service
        .createByAdmin(admin, { ...dto, role: UserRole.admin })
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('activa la cuenta con el rol asignado, audita y notifica', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(
        buildUser({ role: UserRole.gerencia, status: UserStatus.active, approvedAt: new Date() }),
      );

      const result = await service.approve(admin, 'user-1', UserRole.gerencia);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            role: UserRole.gerencia,
            status: UserStatus.active,
            approvedById: 'admin-1',
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.approved', actorId: 'admin-1' }),
      );
      expect(notifications.accountApproved).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@clinica.example', role: UserRole.gerencia }),
      );
      expect(result.status).toBe(UserStatus.active);
    });

    it('rechaza aprobar una cuenta que ya esta activa', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ status: UserStatus.active, role: UserRole.usuario }),
      );

      expect.assertions(4);
      await service
        .approve(admin, 'user-1', UserRole.usuario)
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('protege las cuentas de administrador', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ role: UserRole.admin, status: UserStatus.active }),
      );

      expect.assertions(3);
      await service
        .approve(admin, 'user-1', UserRole.usuario)
        .catch((error: unknown) => expectAppError(error, 'FORBIDDEN', 403));
    });

    it('devuelve NOT_FOUND si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      expect.assertions(3);
      await service
        .approve(admin, 'user-1', UserRole.usuario)
        .catch((error: unknown) => expectAppError(error, 'NOT_FOUND', 404));
    });
  });

  describe('reject', () => {
    it('deja la cuenta rechazada y sin rol', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(buildUser({ status: UserStatus.rejected }));

      await service.reject(admin, 'user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: UserStatus.rejected, role: null },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.rejected' }),
      );
    });
  });

  describe('changeRole', () => {
    it('solo cambia el rol de cuentas activas', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ status: UserStatus.pending }));

      expect.assertions(3);
      await service
        .changeRole(admin, 'user-1', UserRole.gerencia)
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
    });

    it('audita el rol anterior y el nuevo', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ status: UserStatus.active, role: UserRole.usuario }),
      );
      prisma.user.update.mockResolvedValue(
        buildUser({ status: UserStatus.active, role: UserRole.gerencia }),
      );

      await service.changeRole(admin, 'user-1', UserRole.gerencia);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.role_changed',
          metadata: { from: UserRole.usuario, to: UserRole.gerencia },
        }),
      );
    });
  });

  describe('disable', () => {
    it('desactiva la cuenta y borra sus suscripciones push', async () => {
      const disabled = buildUser({ status: UserStatus.disabled });
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ status: UserStatus.active, role: UserRole.usuario }),
      );
      prisma.$transaction.mockResolvedValue([disabled, { count: 2 }]);

      const result = await service.disable(admin, 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.disabled' }),
      );
      expect(result.status).toBe(UserStatus.disabled);
    });

    it('no desactiva dos veces', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ status: UserStatus.disabled }));

      expect.assertions(4);
      await service
        .disable(admin, 'user-1')
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
