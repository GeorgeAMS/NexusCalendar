import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AppError, ErrorCode } from '../common/error-codes';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ASSIGNABLE_ROLES } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { DirectoryUsersDto } from './dto/directory-users.dto';
import { ListUsersDto } from './dto/list-users.dto';
import {
  AuthenticatedUser,
  DirectoryUsersResponse,
  PaginatedUsers,
  PublicUser,
  normalizeEmail,
  toPublicUser,
} from './user.types';

const BCRYPT_ROUNDS = 10;

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_DIRECTORY_LIMIT = 20;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: ListUsersDto): Promise<PaginatedUsers> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        // El enum arranca en `pending`, asi que las solicitudes quedan primero.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: items.map(toPublicUser), total, page, pageSize };
  }

  /**
   * Lista usuarios activos para el selector de invitados.
   * Solo id/nombre/email — sin telefono ni datos de administracion.
   */
  async listDirectory(query: DirectoryUsersDto): Promise<DirectoryUsersResponse> {
    const limit = query.limit ?? DEFAULT_DIRECTORY_LIMIT;
    const q = query.q?.trim();

    const items = await this.prisma.user.findMany({
      where: {
        status: UserStatus.active,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
      take: limit,
    });

    return { items };
  }

  async createByAdmin(actor: AuthenticatedUser, dto: CreateUserDto): Promise<PublicUser> {
    if (!ASSIGNABLE_ROLES.includes(dto.role)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'El rol debe ser usuario o gerencia.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(
        ErrorCode.EMAIL_TAKEN,
        'Ya existe una cuenta con ese correo.',
        HttpStatus.CONFLICT,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: dto.role,
        status: UserStatus.active,
        approvedAt: new Date(),
        approvedById: actor.id,
      },
    });

    await this.audit.record({
      action: 'user.created_by_admin',
      entityType: 'user',
      entityId: user.id,
      actorId: actor.id,
      metadata: { role: dto.role },
    });

    return toPublicUser(user);
  }

  async approve(actor: AuthenticatedUser, id: string, role: UserRole): Promise<PublicUser> {
    const target = await this.findManageable(id);

    if (target.status === UserStatus.active) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'La cuenta ya esta activa. Usa el cambio de rol.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        role,
        status: UserStatus.active,
        approvedAt: new Date(),
        approvedById: actor.id,
      },
    });

    await this.audit.record({
      action: 'user.approved',
      entityType: 'user',
      entityId: id,
      actorId: actor.id,
      metadata: { role, previousStatus: target.status },
    });

    this.notifications.accountApproved({
      userId: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      role,
    });

    return toPublicUser(updated);
  }

  async reject(actor: AuthenticatedUser, id: string): Promise<PublicUser> {
    const target = await this.findManageable(id);

    if (target.status === UserStatus.rejected) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'La solicitud ya estaba rechazada.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.rejected, role: null },
    });

    await this.audit.record({
      action: 'user.rejected',
      entityType: 'user',
      entityId: id,
      actorId: actor.id,
      metadata: { previousStatus: target.status, previousRole: target.role },
    });

    return toPublicUser(updated);
  }

  async changeRole(actor: AuthenticatedUser, id: string, role: UserRole): Promise<PublicUser> {
    const target = await this.findManageable(id);

    if (target.status !== UserStatus.active) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Solo se cambia el rol de cuentas activas.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.user.update({ where: { id }, data: { role } });

    await this.audit.record({
      action: 'user.role_changed',
      entityType: 'user',
      entityId: id,
      actorId: actor.id,
      metadata: { from: target.role, to: role },
    });

    return toPublicUser(updated);
  }

  /** Baja logica: conserva el historial de reservas y anula el acceso. */
  async disable(actor: AuthenticatedUser, id: string): Promise<PublicUser> {
    const target = await this.findManageable(id);

    if (target.status === UserStatus.disabled) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'La cuenta ya estaba desactivada.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { status: UserStatus.disabled },
      }),
      this.prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    ]);

    await this.audit.record({
      action: 'user.disabled',
      entityType: 'user',
      entityId: id,
      actorId: actor.id,
      metadata: { previousStatus: target.status, previousRole: target.role },
    });

    return toPublicUser(updated);
  }

  private async findManageable(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Usuario no encontrado.', HttpStatus.NOT_FOUND);
    }

    if (user.role === UserRole.admin) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'Las cuentas de administrador se gestionan desde el seed.',
        HttpStatus.FORBIDDEN,
      );
    }

    return user;
  }
}
