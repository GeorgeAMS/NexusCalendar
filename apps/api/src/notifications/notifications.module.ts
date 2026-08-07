import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InboxService } from './inbox.service';
import { MailerService } from './mailer.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController, PushController],
  providers: [MailerService, PushService, InboxService, NotificationsService],
  exports: [MailerService, PushService, InboxService, NotificationsService],
})
export class NotificationsModule {}
