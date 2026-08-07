import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { UsersDirectoryController } from './users-directory.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, UsersDirectoryController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
