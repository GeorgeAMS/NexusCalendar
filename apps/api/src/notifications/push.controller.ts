import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../users/user.types';
import { PushSubscribeDto, PushUnsubscribeDto } from './dto/push-subscribe.dto';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  /** `publicKey` null significa que el push no esta configurado en este entorno. */
  @Get('public-key')
  publicKey(): { publicKey: string | null } {
    return { publicKey: this.push.getPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  subscribe(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PushSubscribeDto,
  ): Promise<{ id: string }> {
    return this.push.subscribe(actor.id, dto);
  }

  @Delete('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PushUnsubscribeDto,
  ): Promise<void> {
    return this.push.unsubscribe(actor.id, dto.endpoint);
  }
}
