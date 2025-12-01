import { IsArray, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { toE164 } from '@shared/phone.util';

export class SendWhatsappTemplateDto {
  @Transform(({ value }) => toE164(value, 'AR'))
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  to!: string;

  @IsString()
  @MaxLength(120)
  template!: string; // nombre del template aprobado en Meta

  @IsOptional()
  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value.map(String) : undefined))
  variables?: (string | number)[];
}
