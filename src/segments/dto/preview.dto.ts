// file: src/segments/dto/preview.dto.ts
import { IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PreviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
