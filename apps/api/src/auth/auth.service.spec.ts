import { HttpException } from '@nestjs/common';
import { User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

const PASSWORD = 'secretoSeguro1';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    fullName: 'Ana Perez',
    email: 'ana@clinica.example',
    phone: '3001234567',
    passwordHash: bcrypt.hashSync(PASSWORD, 4),
    role: UserRole.usuario,
    status: UserStatus.active,
    approvedById: null,
    approvedAt: new Date('2026-08-01T12:00:00Z'),
    createdAt: new Date('2026-08-01T10:00:00Z'),
    updatedAt: new Date('2026-08-01T12:00:00Z'),
    ...overrides,
  };
}

function expectAppError(error: unknown, code: string, status: number): void {
  expect(error).toBeInstanceOf(HttpException);
  const httpError = error as HttpException;
  expect(httpError.getStatus()).toBe(status);
  expect((httpError.getResponse() as { code: string }).code).toBe(code);
}

describe('AuthService', () => {
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let audit: { record: jest.Mock };
  let service: AuthService;

  const secrets: Record<string, string> = {
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const config = { get: (key: string) => secrets[key] };

    service = new AuthService(
      prisma as never,
      jwt as never,
      config as never,
      audit as never,
    );
  });

  describe('register', () => {
    const dto = {
      fullName: '  Ana Perez  ',
      email: 'Ana@Clinica.Example',
      phone: '3001234567',
      password: PASSWORD,
    };

    it('crea la cuenta en estado pending, normaliza el correo y audita', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: { data: Partial<User> }) =>
        Promise.resolve(buildUser({ ...data, role: null, status: UserStatus.pending })),
      );

      const result = await service.register(dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'ana@clinica.example',
            fullName: 'Ana Perez',
            status: UserStatus.pending,
          }),
        }),
      );

      const created = prisma.user.create.mock.calls[0][0].data as { passwordHash: string };
      expect(created.passwordHash).not.toBe(PASSWORD);
      expect(bcrypt.compareSync(PASSWORD, created.passwordHash)).toBe(true);

      expect(result.status).toBe(UserStatus.pending);
      expect(result.role).toBeNull();
      expect(result).not.toHaveProperty('passwordHash');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.registered' }),
      );
    });

    it('rechaza correos duplicados con EMAIL_TAKEN', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await expect(service.register(dto)).rejects.toBeInstanceOf(HttpException);
      await service.register(dto).catch((error: unknown) => {
        expectAppError(error, 'EMAIL_TAKEN', 409);
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const credentials = { email: 'ana@clinica.example', password: PASSWORD };

    it('entrega tokens y sesion cuando la cuenta esta activa', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const result = await service.login(credentials);

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user).toEqual({
        id: 'user-1',
        fullName: 'Ana Perez',
        email: 'ana@clinica.example',
        role: UserRole.usuario,
        status: UserStatus.active,
      });
    });

    it('rechaza contrasena incorrecta con UNAUTHORIZED', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await service
        .login({ ...credentials, password: 'otraClave123' })
        .catch((error: unknown) => expectAppError(error, 'UNAUTHORIZED', 401));
    });

    it('rechaza correo inexistente con UNAUTHORIZED', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service
        .login(credentials)
        .catch((error: unknown) => expectAppError(error, 'UNAUTHORIZED', 401));
    });

    it.each([
      [UserStatus.pending, null, 'ACCOUNT_PENDING'],
      [UserStatus.rejected, null, 'ACCOUNT_REJECTED'],
      [UserStatus.disabled, UserRole.usuario, 'ACCOUNT_DISABLED'],
      [UserStatus.active, null, 'ACCOUNT_PENDING'],
    ])('bloquea el login con status %s y devuelve %s', async (status, role, code) => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ status, role }));

      expect.assertions(3);
      await service
        .login(credentials)
        .catch((error: unknown) => expectAppError(error, code, 403));
    });
  });

  describe('refresh', () => {
    it('rechaza un token que no es de refresh', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'access' });

      expect.assertions(3);
      await service
        .refresh('token')
        .catch((error: unknown) => expectAppError(error, 'UNAUTHORIZED', 401));
    });

    it('renueva tokens de una cuenta activa', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      await expect(service.refresh('token')).resolves.toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });
  });

  describe('userFromAccessToken', () => {
    it('devuelve el perfil sin datos sensibles', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const user = await service.userFromAccessToken('token');

      expect(user.id).toBe('user-1');
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('rechaza si la cuenta quedo desactivada', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ status: UserStatus.disabled }),
      );

      expect.assertions(3);
      await service
        .userFromAccessToken('token')
        .catch((error: unknown) => expectAppError(error, 'ACCOUNT_DISABLED', 403));
    });
  });

  describe('changePassword', () => {
    const dto = { currentPassword: PASSWORD, newPassword: 'NuevaClave99' };

    it('actualiza el hash, audita y responde ok', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(buildUser());

      await expect(service.changePassword('user-1', dto)).resolves.toEqual({ ok: true });

      const updateArg = prisma.user.update.mock.calls[0][0] as {
        where: { id: string };
        data: { passwordHash: string };
      };
      expect(updateArg.where.id).toBe('user-1');
      expect(bcrypt.compareSync(dto.newPassword, updateArg.data.passwordHash)).toBe(true);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.password_changed', actorId: 'user-1' }),
      );
    });

    it('rechaza contrasena actual incorrecta', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      expect.assertions(4);
      await service
        .changePassword('user-1', { ...dto, currentPassword: 'otraClave123' })
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rechaza si la nueva contrasena es igual a la actual', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      expect.assertions(4);
      await service
        .changePassword('user-1', { currentPassword: PASSWORD, newPassword: PASSWORD })
        .catch((error: unknown) => expectAppError(error, 'VALIDATION_ERROR', 400));
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
