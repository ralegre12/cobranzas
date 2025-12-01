// file: src/debts/dto/import-options.dto.ts
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum DateFmt {
  AUTO = 'auto',
  YMD = 'YYYY-MM-DD',
  DMY = 'DD/MM/YYYY',
}

export class ImportOptionsDto {
  /** preview: valida sin persistir */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true) // "true" -> true
  @IsBoolean()
  preview?: boolean;

  /** formato de fecha preferido */
  @IsOptional()
  @IsEnum(DateFmt)
  dateFmt?: DateFmt;

  /** país para normalizar teléfono (E.164) */
  @IsOptional()
  @IsString()
  country?: string;

  /** crear Case abierto si no existe */
  @IsOptional()
  @Transform(({ value }) => !(value === 'false' || value === false)) // default true
  @IsBoolean()
  createCase?: boolean;
}
