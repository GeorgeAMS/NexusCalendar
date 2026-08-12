import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Indica tu contrasena actual.' })
  @MaxLength(72)
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'La nueva contrasena debe tener al menos 8 caracteres.' })
  @MaxLength(72)
  newPassword!: string;
}
