import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment as PaymentEntity } from '../entities/payment.entity';
import { PaymentsService } from './payments.service';
import type { RedisClientType } from 'redis';
import { REDIS } from '../shared/redis.module';
import { CreateLinkDto } from './dto/create-link.dto';
import * as crypto from 'crypto';

@ApiTags('payments')
@Controller('payments')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    @Inject(REDIS) private readonly redis: RedisClientType,
  ) {}

  @Post('create-link')
  createLink(@Body() dto: CreateLinkDto) {
    return this.payments.createPaymentLink(dto);
  }

  /** Webhook Mercado Pago (v2). Idempotente vía Redis; firma opcional. */
  @HttpCode(200)
  @Post('webhooks/mercadopago')
  async mpWebhook(
    @Headers('x-idempotency-key') xIdem: string | undefined,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Body() payload: any,
  ) {
    // (Opcional) verifica firma MP v2
    const okSig = verifyMpSignature(xSignature, xRequestId, payload);
    if (process.env.MP_WEBHOOK_SECRET && !okSig) {
      throw new HttpException('Unauthorized (bad signature)', 401);
    }

    // Idempotencia (1h)
    const paymentId =
      payload?.data?.id ||
      payload?.resource ||
      payload?.id ||
      payload?.resourceId ||
      payload?.data?.resourceId;

    const keyBase = xIdem || paymentId || xRequestId || `unknown-${Date.now()}`;
    const key = `mp:webhook:${keyBase}`;
    const res = await this.redis.set(key, '1', { EX: 3600, NX: true });
    if (res !== 'OK') return { ok: true, deduped: true };

    // Procesar
    await this.payments.handleMpNotification(payload);
    return { ok: true };
  }
}

function verifyMpSignature(
  xSignature: string | undefined,
  xRequestId: string | undefined,
  payload: any,
) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // firma deshabilitada
  try {
    if (!xSignature || !xRequestId) return false;
    // x-signature: "ts=...,v1=..."
    const parts = Object.fromEntries(
      xSignature.split(',').map((s) => s.trim().split('=')) as [string, string][],
    );
    const ts = parts['ts'];
    const v1 = parts['v1'];
    const id = payload?.data?.id || payload?.resource || payload?.id || payload?.resourceId || '';
    if (!ts || !v1 || !id) return false;
    const text = `id:${id};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', secret).update(text).digest('hex');
    return hmac === v1;
  } catch {
    return false;
  }
}
