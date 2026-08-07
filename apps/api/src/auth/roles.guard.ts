import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AppError, ErrorCode } from '../common/error-codes';
import { RequestWithUser } from './jwt-auth.guard';
import { ROLES_KEY } from './roles.decorator';

/** Debe usarse siempre despues de JwtAuthGuard, que es quien resuelve request.user. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;

    if (!user) {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'Falta el token de acceso.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!required.includes(user.role)) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        'No tienes permisos para esta accion.',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
