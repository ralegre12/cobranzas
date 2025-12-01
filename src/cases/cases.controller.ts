// file: src/cases/cases.controller.ts
import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { CasesService } from './cases.service';
import { SetStatusDto } from './dto/set-status.dto';

@Controller('cases')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class CasesController {
  constructor(private readonly svc: CasesService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Get(':id/balance')
  balance(@Param('id') id: string) {
    return this.svc.getBalance(id);
  }

  @Post(':id/close-if-zero')
  closeIfZero(@Param('id') id: string) {
    return this.svc.closeIfZero(id);
  }

  @Post(':id/reopen-if-positive')
  reopenIfPositive(@Param('id') id: string) {
    return this.svc.reopenIfPositive(id);
  }

  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.svc.setStatus(id, dto.status);
  }
}
