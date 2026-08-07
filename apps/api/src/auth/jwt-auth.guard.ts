import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AppError, ErrorCode } from '../common/error-codes';
import { AuthenticatedUser } from '../users/user.types';
import { AuthService } from './auth.service';

export type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        'Falta el token de acceso.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.user = await this.auth.userFromAccessToken(header.slice('Bearer '.length).trim());

    return true;
  }
}
