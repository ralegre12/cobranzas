import { Controller, Get } from '@nestjs/common';
@Controller('status')
export class AppStatusController {
  @Get()
  ok() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
