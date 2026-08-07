import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../users/user.types';
import { ListNotificationsDto, MarkReadDto } from './dto/list-notifications.dto';
import { InboxService } from './inbox.service';
import { InboxItem } from './notification.types';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListNotificationsDto,
  ): Promise<{ items: InboxItem[]; unread: number }> {
    return this.inbox.list(actor.id, { unreadOnly: query.unread, limit: query.limit });
  }

  @Post('read')
  markRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    return this.inbox.markRead(actor.id, dto.ids);
  }
}
