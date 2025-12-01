import {
  All,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import * as crypto from 'crypto';
import { MessagingService } from './messaging.service';
import { SendWhatsappTemplateDto } from './dto/send-whatsapp.dto';
import { JobsService } from '../jobs/jobs.service';
import { Q_NLP_INBOUND } from '../jobs/queues';
import { ApiKeyGuard } from './security/api-key.guard';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@ApiTags('messaging/whatsapp')
@Controller('messaging/whatsapp')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class WhatsappController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly jobs: JobsService,
  ) {}
  private readonly logger = new Logger(WhatsappController.name); // 👈

  // Envío outbound por template (empresa->cliente)
  @UseGuards(ApiKeyGuard)
  @Post('template')
  @ApiBody({ type: SendWhatsappTemplateDto })
  async sendTemplate(@Body() dto: SendWhatsappTemplateDto) {
    return this.messaging.sendWhatsappTemplate(dto);
  }

  // Verificación GET de webhook (Meta)
  @Get('webhook')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'verify-me')) {
      return challenge ?? '';
    }
    throw new HttpException('Unauthorized', 401);
  }

  // Webhook POST (Meta) con verificación HMAC opcional
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: FastifyRequest,
    @Headers('x-hub-signature-256') xHubSig256: string | undefined,
    @Body() payload: any,
  ) {
    console.log('[WA-WEBHOOK][ENTER]', new Date().toISOString());
    console.log('[WA-WEBHOOK][HEADERS]', (req as any).headers);
    console.log('[WA-WEBHOOK][BODY]', typeof payload, JSON.stringify(payload || {}));
    const appSecret = process.env.WA_APP_SECRET;
    if (appSecret) {
      const raw = (req as any).rawBody as Buffer | string | undefined;
      if (!raw) throw new HttpException('Missing raw body', 400);
      const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
      if (!xHubSig256 || xHubSig256 !== expected) throw new HttpException('Unauthorized', 401);
    }

    const entries = payload?.entry ?? [];

    for (const entry of entries) {
      const changes = entry?.changes ?? [];
      this.logger.log(`[WA-WEBHOOK] changes=${changes.length}`);

      for (const ch of changes) {
        const value = ch?.value;
        const msgs = value?.messages ?? [];
        const statuses = value?.statuses ?? [];

        if (statuses.length) {
          this.logger.log(`[WA-WEBHOOK] statuses=${statuses.length}`);
        }
        if (msgs.length) {
          this.logger.log(`[WA-WEBHOOK] messages=${msgs.length}`);
        }

        for (const s of statuses) {
          const providerId = (s?.id ?? '').trim();
          const status = String(s?.status ?? '');
          this.logger.log(`[WA-WEBHOOK] status update id=${providerId} status=${status}`);
          await this.messaging.updateStatusByExternalId('WHATSAPP', providerId, status, s);
        }

        for (const m of msgs) {
          if (m?.type !== 'text') continue;
          const providerId = m.id;
          const from = m.from;
          const text = m.text?.body ?? '';
          const timestamp = Number(m.timestamp ?? Date.now() / 1000) * 1000;

          await this.jobs.addJob(
            Q_NLP_INBOUND,
            { provider: 'whatsapp', providerId, from, text, timestamp },
            { removeOnComplete: true },
          );
        }
      }
    }

    return { ok: true };
  }
}
