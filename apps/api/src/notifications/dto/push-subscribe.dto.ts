import { Type } from 'class-transformer';
import { IsObject, IsString, IsUrl, Length, ValidateNested } from 'class-validator';

class PushKeysDto {
  @IsString()
  @Length(16, 200)
  p256dh!: string;

  @IsString()
  @Length(8, 200)
  auth!: string;
}

export class PushSubscribeDto {
  @IsUrl({ require_tld: false }, { message: 'endpoint debe ser una URL valida.' })
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}

export class PushUnsubscribeDto {
  @IsUrl({ require_tld: false }, { message: 'endpoint debe ser una URL valida.' })
  endpoint!: string;
}
