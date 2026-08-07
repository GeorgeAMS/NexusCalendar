import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { DATE_ONLY_PATTERN, TIME_PATTERN } from '../../common/dates';

export class CreateReservationDto {
  @IsUUID()
  roomId!: string;

  @IsString()
  @Length(3, 140)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @Matches(DATE_ONLY_PATTERN, { message: 'meetingDate debe tener formato YYYY-MM-DD.' })
  meetingDate!: string;

  @Matches(TIME_PATTERN, { message: 'startTime debe tener formato HH:mm.' })
  startTime!: string;

  @Matches(TIME_PATTERN, { message: 'endTime debe tener formato HH:mm.' })
  endTime!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true, message: 'Cada invitado debe tener un correo valido.' })
  inviteeEmails?: string[];

  /** Sobreescribir una sala ocupada. Solo gerencia. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
