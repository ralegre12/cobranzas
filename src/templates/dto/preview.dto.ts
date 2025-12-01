// file: src/templates/dto/preview.dto.ts
import { IsObject } from 'class-validator';

export class PreviewDto {
  @IsObject()
  vars!: Record<string, string | number>;
}
