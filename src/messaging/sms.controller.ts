// src/messaging/sms.controller.ts
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FastifyRequest } from 'fastify';
import { MessagingService } from './messaging.service';
import { SendSmsDto } from './dto/send-sms.dto';
import { Message } from '@entities/message.entity';
import { validateRequest as validateTwilioSignature } from 'twilio/lib/webhooks/webhooks';
import { SkipThrottle } from '@nestjs/throttler';

@SkipThrottle()
@ApiTags('messaging/sms')
@Controller('messaging/sms')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class SmsController {
  constructor(
    private readonly messaging: MessagingService,
    @InjectRepository(Message) private readonly repo: Repository<Message>,
  ) {}

  @Post()
  @ApiBody({ type: SendSmsDto })
  sendSms(@Body() dto: SendSmsDto) {
    return this.messaging.sendSms(dto);
  }

  // Webhook de estado Twilio (status callback)
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: FastifyRequest,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Body() body: any,
  ) {
    // (Opcional) Validar firma Twilio si tenés AUTH_TOKEN y URL pública fija:
    // if (process.env.TWILIO_AUTH_TOKEN && signature) {
    //   const ok = validateTwilioSignature(
    //     process.env.TWILIO_AUTH_TOKEN!,
    //     (req as any).originalUrl ?? '', // asegurate de tener la URL absoluta si estás detrás de proxy
    //     body,
    //     signature
    //   );
    //   if (!ok) return 'INVALID SIGNATURE';
    // }

    const sid: string | undefined = body?.MessageSid;
    const stRaw: string = String(body?.MessageStatus ?? '').toLowerCase();

    // normalización
    const map: Record<string, string> = {
      queued: 'SENT',
      sending: 'SENT',
      sent: 'SENT',
      delivered: 'DELIVERED',
      undelivered: 'FAILED',
      failed: 'FAILED',
      read: 'READ', // canales con receipt (WA)
    };
    const status = map[stRaw] ?? stRaw.toUpperCase();

    if (sid) {
      await this.messaging.updateStatusByExternalId('SMS', sid, stRaw, body);
    }
    return 'OK';
  }
}
