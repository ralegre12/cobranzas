// file: src/webhooks/whatsapp.webhook.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { IdempotencyService } from '../shared/idempotency.service';
import { JobsService } from '../jobs/jobs.service';
import { Q_NLP_INBOUND } from '../jobs/queues';

type MetaText = { body?: string };
type MetaButton = { text?: string };
type MetaListReply = { title?: string };
type MetaInteractive =
  | { type: 'button'; button_reply?: MetaButton }
  | { type: 'list_reply'; list_reply?: MetaListReply };

type MetaMessage = {
  id?: string;
  from?: string; // ej: "54911..."
  timestamp?: string; // epoch (segundos)
  type?: string; // 'text' | 'interactive' | ...
  text?: MetaText;
  interactive?: MetaInteractive;
};

@Controller('webhooks/whatsapp')
export class WebhooksWhatsappController {
  constructor(
    private readonly idem: IdempotencyService,
    private readonly jobs: JobsService,
  ) {}

  /** Verificación del webhook (GET) */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) return challenge;
    return 'forbidden';
  }

  /** Recepción de eventos (POST) */
  @Post()
  @HttpCode(200)
  async inbound(
    @Req() req: FastifyRequest, // para firma HMAC (opcional)
    @Headers('x-hub-signature-256') xHubSig256: string | undefined,
    @Body() payload: any,
  ) {
    // 0) Verificación opcional de firma (recomendado en prod)
    const appSecret = process.env.WA_APP_SECRET;
    if (appSecret) {
      const raw = (req as any).rawBody as string | Buffer | undefined;
      if (!raw) throw new HttpException('Missing raw body', 400);
      const expected = this.computeMetaSig256(appSecret, raw);
      if (!xHubSig256 || xHubSig256 !== expected) {
        throw new HttpException('Unauthorized (bad signature)', 401);
      }
    }

    // 1) Desarmar estructura de Meta y extraer mensajes
    const entries: any[] = payload?.entry ?? [];
    let enqueued = 0;

    for (const entry of entries) {
      const changes: any[] = entry?.changes ?? [];
      for (const ch of changes) {
        const value = ch?.value;
        const messages: MetaMessage[] = value?.messages ?? [];
        if (!messages.length) continue;

        for (const m of messages) {
          const providerId = m.id || '';
          const fromE164 = (m.from || '').replace(/^whatsapp:/, '');
          const text = this.extractText(m);
          const tsMs = m.timestamp ? Number(m.timestamp) * 1000 : Date.now();

          // 2) Idempotencia por providerId (si existe) o fallback (from+ts)
          const idemKey = providerId ? `wa:in:${providerId}` : `wa:in:${fromE164}:${tsMs}`;
          const fresh = await this.idem.reserveOnce(idemKey, 24 * 3600);
          if (!fresh) continue;

          // 3) Encolar para NLP → Q_NLP_INBOUND
          //    No pasamos case/tenant: lo resuelve el runtime por último OUT/contacto→case OPEN
          await this.jobs.addJob(
            Q_NLP_INBOUND,
            {
              tenantId: 0, // si no lo tenés, 0/'' y el runtime lo infiere
              channel: 'WHATSAPP',
              from: fromE164,
              text,
              providerId: providerId || undefined,
              timestamp: tsMs,
              raw: m,
            },
            { removeOnComplete: true, attempts: 3 },
          );
          enqueued++;
        }
      }
    }

    return { ok: true, enqueued };
  }

  /** texto según tipo de mensaje (text, button, list) */
  private extractText(m: MetaMessage): string {
    if (m.type === 'text') return m.text?.body?.trim?.() || '';
    if (m.type === 'interactive') {
      const it = m.interactive;
      if ((it as any)?.type === 'button') {
        return (it as any)?.button_reply?.text?.trim?.() || '';
      }
      if ((it as any)?.type === 'list_reply') {
        return (it as any)?.list_reply?.title?.trim?.() || '';
      }
    }
    // Otros tipos (imagen, audio, etc.) → texto vacío
    return '';
  }

  /** firma hmac-sha256 de Meta: "sha256=" + HMAC(app_secret, rawBody) */
  private computeMetaSig256(secret: string, raw: string | Buffer) {
    const crypto = require('crypto') as typeof import('crypto');
    const h = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    return `sha256=${h}`;
  }
}
