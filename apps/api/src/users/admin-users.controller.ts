import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { AuthenticatedUser, PaginatedUsers, PublicUser } from './user.types';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersDto): Promise<PaginatedUsers> {
    return this.users.list(query);
  }

  @Patch(':id/approve')
  approve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ): Promise<PublicUser> {
    return this.users.approve(actor, id, dto.role);
  }

  @Patch(':id/reject')
  reject(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicUser> {
    return this.users.reject(actor, id);
  }

  @Patch(':id/role')
  changeRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleDto,
  ): Promise<PublicUser> {
    return this.users.changeRole(actor, id, dto.role);
  }

  @Delete(':id')
  disable(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicUser> {
    return this.users.disable(actor, id);
  }
}
