import { IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/** Query DTO para endpoints con rango temporal */
export class RangeDto {
  /** ISO date (YYYY-MM-DD). Default: 30 días atrás */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : undefined))
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  /** ISO date (YYYY-MM-DD). Default: hoy */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value : undefined))
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;

  /** Timezone IANA (p. ej. America/Argentina/Buenos_Aires). Default: UTC */
  @IsOptional()
  @IsString()
  tz?: string;
}
