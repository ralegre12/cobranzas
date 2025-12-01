import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { Twilio } from 'twilio';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  // ---------- EMAIL ----------
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // ---------- SMS (Twilio) ----------
  private twilio = new Twilio(
    process.env.TWILIO_ACCOUNT_SID ?? '',
    process.env.TWILIO_AUTH_TOKEN ?? '',
  );
  private twilioFrom = process.env.TWILIO_FROM ?? '';

  // ---------- WHATSAPP (Meta) ----------
  async sendWhatsappTemplate(dto: {
    to: string;
    template: string;
    variables?: (string | number)[];
  }) {
    const { WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN } = process.env as any;

    // Simulación si no hay credenciales
    if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN) {
      this.logger.log(
        `[SIM] WhatsApp → to=${dto.to} tpl=${dto.template} vars=${JSON.stringify(dto.variables ?? [])}`,
      );
      return { externalId: `wa_${Date.now()}`, status: 'SENT' };
    }

    try {
      const url = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`;

      // Armar "components" para variables de template (body)
      const components = dto.variables?.length
        ? [
            {
              type: 'body',
              parameters: dto.variables.map((v) => ({
                type: 'text',
                text: String(v),
              })),
            },
          ]
        : undefined;

      const payload: any = {
        messaging_product: 'whatsapp',
        to: dto.to,
        type: 'template',
        template: {
          name: dto.template,
          language: { code: 'es_AR' },
          ...(components ? { components } : {}),
        },
      };

      const res = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      return {
        externalId: res.data?.messages?.[0]?.id ?? `wa_${Date.now()}`,
        status: 'SENT',
      };
    } catch (err: any) {
      this.logger.error(
        `WA error: ${err?.response?.status} ${JSON.stringify(err?.response?.data)}`,
      );
      throw new InternalServerErrorException('No se pudo enviar WhatsApp');
    }
  }

  async sendEmail(dto: { to: string; subject: string; text?: string; html?: string }) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      this.logger.log(`[SIM] Email → to=${dto.to} subject=${dto.subject}`);
      return { messageId: `mail_${Date.now()}`, status: 'SENT' };
    }
    try {
      const info = await this.transporter.sendMail({
        from: `"Cobranzas" <${process.env.SMTP_USER}>`,
        to: dto.to,
        subject: dto.subject,
        text: dto.text,
        html: dto.html,
      });
      this.logger.log(`Email enviado a ${dto.to}, id: ${info.messageId}`);
      return { messageId: info.messageId, status: 'SENT' };
    } catch (err: any) {
      this.logger.error(`Email error: ${err?.message || err}`);
      throw new InternalServerErrorException('No se pudo enviar Email');
    }
  }

  async sendSms(dto: { to: string; message: string }) {
    if (!this.twilio.accountSid || !this.twilioFrom) {
      this.logger.log(`[SIM] SMS → to=${dto.to} msg=${dto.message}`);
      return { sid: `sms_${Date.now()}`, status: 'SENT' };
    }
    try {
      const msg = await this.twilio.messages.create({
        from: this.twilioFrom,
        to: dto.to,
        body: dto.message,
      });
      return { sid: msg.sid, status: msg.status ?? 'queued' };
    } catch (err: any) {
      this.logger.error(`SMS error: ${err?.message || err}`);
      throw new InternalServerErrorException('No se pudo enviar SMS');
    }
  }

  // opcional, para replies dentro de una conversación activa
  async sendWhatsappText(dto: { to: string; text: string }) {
    const { WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN } = process.env as any;
    if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN) {
      this.logger.log(`[SIM] WA TEXT → to=${dto.to} text=${dto.text}`);
      return { externalId: `wa_${Date.now()}`, status: 'SENT' };
    }
    try {
      const url = `https://graph.facebook.com/v20.0/${WA_PHONE_NUMBER_ID}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        to: dto.to,
        type: 'text',
        text: { body: dto.text },
      };
      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` },
      });
      return { externalId: res.data?.messages?.[0]?.id ?? `wa_${Date.now()}`, status: 'SENT' };
    } catch (e: any) {
      this.logger.error(
        `WA text error: ${e?.response?.status} ${JSON.stringify(e?.response?.data)}`,
      );
      throw new InternalServerErrorException('No se pudo enviar WA text');
    }
  }
}
