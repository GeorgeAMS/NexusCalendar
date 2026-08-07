import { ReservationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { DATE_ONLY_PATTERN } from '../../common/dates';

export class ListReservationsDto {
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'from debe tener formato YYYY-MM-DD.' })
  from?: string;

  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, { message: 'to debe tener formato YYYY-MM-DD.' })
  to?: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;
}
