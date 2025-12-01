// file: src/cases/dto/set-status.dto.ts
import { IsIn } from 'class-validator';
export class SetStatusDto {
  @IsIn(['OPEN', 'PAID', 'CANCELLED'])
  status!: 'OPEN' | 'PAID' | 'CANCELLED';
}
