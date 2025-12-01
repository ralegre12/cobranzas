import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import { toE164 } from '@shared/phone.util';

export class SendSmsDto {
  @Transform(({ value }) => toE164(value, 'AR'))
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  to!: string;

  @IsString()
  @MaxLength(600)
  message!: string;
}
