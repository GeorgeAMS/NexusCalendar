import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 120)
  fullName!: string;

  @IsEmail({}, { message: 'El correo no tiene un formato valido.' })
  @MaxLength(180)
  email!: string;

  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/, {
    message: 'El telefono solo admite numeros y separadores.',
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres.' })
  @MaxLength(72)
  password!: string;
}
