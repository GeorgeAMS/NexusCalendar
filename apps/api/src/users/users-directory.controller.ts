import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DirectoryUsersDto } from './dto/directory-users.dto';
import { DirectoryUsersResponse } from './user.types';
import { UsersService } from './users.service';

/**
 * Directorio reducido de usuarios activos para invitar a reservas.
 * No expone telefono, estado ni endpoints de administracion.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.usuario, UserRole.gerencia, UserRole.admin)
export class UsersDirectoryController {
  constructor(private readonly users: UsersService) {}

  @Get('directory')
  directory(@Query() query: DirectoryUsersDto): Promise<DirectoryUsersResponse> {
    return this.users.listDirectory(query);
  }
}
