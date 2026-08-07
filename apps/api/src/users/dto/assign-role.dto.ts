import { UserRole } from '@prisma/client';
import { IsIn } from 'class-validator';

/** El rol `admin` no se asigna por API: se crea con el seed. */
export const ASSIGNABLE_ROLES: UserRole[] = [UserRole.usuario, UserRole.gerencia];

export class AssignRoleDto {
  @IsIn(ASSIGNABLE_ROLES, {
    message: 'El rol debe ser usuario o gerencia.',
  })
  role!: UserRole;
}
