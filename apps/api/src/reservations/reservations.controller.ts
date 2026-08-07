import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../users/user.types';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsDto } from './dto/list-reservations.dto';
import { ReservationDto } from './reservation.types';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  list(@Query() query: ListReservationsDto): Promise<{ items: ReservationDto[] }> {
    return this.reservations.list(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<ReservationDto> {
    return this.reservations.findById(id);
  }

  @Post()
  @Roles(UserRole.usuario, UserRole.gerencia)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationDto> {
    return this.reservations.create(actor, dto);
  }

  @Delete(':id')
  @Roles(UserRole.usuario, UserRole.gerencia)
  @HttpCode(HttpStatus.NO_CONTENT)
  cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.reservations.cancel(actor, id);
  }
}
