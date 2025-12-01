// file: src/payments/dto/create-link.dto.ts
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateLinkDto {
  @IsUUID()
  caseId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  currency?: string; // default ARS
}
