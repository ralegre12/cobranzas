import { Body, Controller, Post } from '@nestjs/common';
import { InboundService } from './inbound.service';
import { Channel } from '../jobs/queues';

@Controller('inbound')
export class InboundController {
  constructor(private readonly inbound: InboundService) {}

  @Post('webhook')
  async webhook(@Body() body: any) {
    const tenantId = body.tenantId ?? 'demo';
    const from = String(body.from || '');
    const channel: Channel = (body.channel as Channel) ?? 'WHATSAPP';
    const text = String(body.text || '');
    const caseId: string | undefined = body.caseId;
    return this.inbound.handle({ tenantId, from, channel, text, caseId });
  }
}
