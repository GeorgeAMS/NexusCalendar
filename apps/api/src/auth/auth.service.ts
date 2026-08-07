import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AppError, ErrorCode } from '../common/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthenticatedUser,
  PublicUser,
  SessionUser,
  normalizeEmail,
  toPublicUser,
  toSessionUser,
} from '../users/user.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: SessionUser;
}

interface AccessPayload {
  sub: string;
}

interface RefreshPayload {
  sub: string;
  type: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
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
        status: UserStatus.pending,
      },
    });

    await this.audit.record({
      action: 'user.registered',
      entityType: 'user',
      entityId: user.id,
      actorId: user.id,
    });

    return toPublicUser(user);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
    });

    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'Correo o contrasena incorrectos.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.assertCanSignIn(user);

    return { ...(await this.issueTokens(user)), user: toSessionUser(user) };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.secret('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw this.invalidSession();
    }

    if (payload.type !== 'refresh') {
      throw this.invalidSession();
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw this.invalidSession();
    }

    this.assertCanSignIn(user);

    return this.issueTokens(user);
  }

  /** Resuelve el usuario de un access token y confirma que sigue habilitado. */
  async userFromAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(accessToken, {
        secret: this.secret('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw this.invalidSession();
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw this.invalidSession();
    }

    this.assertCanSignIn(user);

    return toPublicUser(user) as AuthenticatedUser;
  }

  private assertCanSignIn(user: User): void {
    switch (user.status) {
      case UserStatus.pending:
        throw new AppError(
          ErrorCode.ACCOUNT_PENDING,
          'Tu solicitud esta en revision. El administrador debe asignarte un rol.',
          HttpStatus.FORBIDDEN,
        );
      case UserStatus.rejected:
        throw new AppError(
          ErrorCode.ACCOUNT_REJECTED,
          'Tu solicitud fue rechazada. Comunicate con el area de sistemas.',
          HttpStatus.FORBIDDEN,
        );
      case UserStatus.disabled:
        throw new AppError(
          ErrorCode.ACCOUNT_DISABLED,
          'Tu cuenta esta desactivada.',
          HttpStatus.FORBIDDEN,
        );
      case UserStatus.active:
        if (!user.role) {
          throw new AppError(
            ErrorCode.ACCOUNT_PENDING,
            'Tu cuenta aun no tiene un rol asignado.',
            HttpStatus.FORBIDDEN,
          );
        }
    }
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: user.id, role: user.role, status: user.status },
        {
          secret: this.secret('JWT_ACCESS_SECRET'),
          expiresIn: this.ttl('JWT_ACCESS_TTL', '15m'),
        },
      ),
      this.jwt.signAsync(
        { sub: user.id, type: 'refresh' },
        {
          secret: this.secret('JWT_REFRESH_SECRET'),
          expiresIn: this.ttl('JWT_REFRESH_TTL', '7d'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /** `expiresIn` usa el formato de `ms` ("15m", "7d"), tipado como literal por jsonwebtoken. */
  private ttl(
    key: 'JWT_ACCESS_TTL' | 'JWT_REFRESH_TTL',
    fallback: string,
  ): JwtSignOptions['expiresIn'] {
    return (this.config.get<string>(key) ?? fallback) as JwtSignOptions['expiresIn'];
  }

  private secret(key: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Falta la variable de entorno ${key}`);
    }
    return value;
  }

  private invalidSession(): AppError {
    return new AppError(
      ErrorCode.UNAUTHORIZED,
      'Sesion invalida o expirada.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
