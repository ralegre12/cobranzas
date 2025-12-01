// file: src/segments/dto/create-segment.dto.ts
import { IsString, Length } from 'class-validator';

export class CreateSegmentDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  /** Debe ser SELECT ... (sin ';'). Debe devolver una columna 'id' (cases.id) */
  @IsString()
  filterSql!: string;
}
