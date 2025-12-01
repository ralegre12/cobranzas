import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import * as crypto from 'crypto';

import { IdempotencyService } from '../shared/idempotency.service';
import { PaymentsService } from '../payments/payments.service';

@Controller('webhooks/mercadopago')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class WebhooksPaymentsController {
  constructor(
    private readonly idem: IdempotencyService,
    private readonly payments: PaymentsService,
  ) {}

  @HttpCode(200)
  @Post()
  async handle(
    @Req() _req: FastifyRequest, // si necesitás rawBody, ver notas abajo
    @Headers('x-idempotency-key') idemKey: string | undefined,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Body() payload: any,
  ) {
    // (Opcional) Verificar firma v2 si está configurada
    if (process.env.MP_WEBHOOK_SECRET) {
      const ok = verifyMpSignature(xSignature, xRequestId, payload, process.env.MP_WEBHOOK_SECRET);
      if (!ok) throw new HttpException('Unauthorized (bad signature)', 401);
    }

    // Idempotencia (60 min)
    const base = idemKey || payload?.data?.id || payload?.id || String(Date.now());
    const reserved = await this.idem.reserveOnce(`mp:webhook:${base}`, 3600);
    if (!reserved) return { ok: true, deduped: true };

    await this.payments.handleMpNotification(payload);
    return { ok: true };
  }
}

/** Firma MP v2: x-signature="ts=...,v1=..." con base:
 * text = `id:${id};request-id:${xRequestId};ts:${ts};`
 */
function verifyMpSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  payload: any,
  secret: string,
) {
  try {
    if (!xSignature || !xRequestId || !secret) return false;
    const parts = Object.fromEntries(
      xSignature.split(',').map((s) => s.trim().split('=')) as [string, string][],
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];
    const id = payload?.data?.id || payload?.id || '';
    if (!ts || !v1 || !id) return false;
    const text = `id:${id};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', secret).update(text).digest('hex');
    return hmac === v1;
  } catch {
    return false;
  }
}
