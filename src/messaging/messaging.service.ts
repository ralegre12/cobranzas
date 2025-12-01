// file: src/messaging/messaging.service.ts
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { Twilio } from 'twilio';
import { MessageRepository } from './message.repository';

type Channel = 'WHATSAPP' | 'SMS' | 'EMAIL';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(private readonly messageRepo: MessageRepository) {}

  // ---------- EMAIL (SMTP) ----------
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  // ---------- SMS (Twilio) ----------
  private twilio = new Twilio(
    process.env.TWILIO_ACCOUNT_SID ?? '',
    process.env.TWILIO_AUTH_TOKEN ?? '',
  );
  private twilioFrom = process.env.TWILIO_FROM ?? '';

  // ---------- WhatsApp (Meta) ----------
  private graphBase = (process.env.META_GRAPH_BASE_URL || 'https://graph.facebook.com').replace(
    /\/+$/,
    '',
  );
  private waVersion = process.env.WA_API_VERSION || 'v20.0';

  // ---------- Twilio override (WireMock) ----------
  private twilioBase = process.env.TWILIO_BASE_URL?.replace(/\/+$/, '');

  // ============================================================
  // WHATSAPP TEMPLATE (HSM)
  // ============================================================
  async sendWhatsappTemplate(
    dto: {
      to: string;
      template: string; // nombre del template aprobado en Meta
      variables?: (string | number)[];
      /** Si viene, se actualiza esa fila (evita duplicados) */
      messageId?: string;
    },
    opts?: { persist?: boolean }, // default true
  ) {
    const persist = opts?.persist !== false;
    const { WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN } = process.env as any;

    // --- SIMULACIÓN ---
    if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN) {
      this.logger.log(
        `[SIM] WA template → to=${dto.to} tpl=${dto.template} vars=${JSON.stringify(
          dto.variables ?? [],
        )}`,
      );
      const externalId = `wa_${Date.now()}`;

      if (dto.messageId) {
        await this.messageRepo.updateById(dto.messageId, {
          status: 'SENT',
          externalId,
          toAddress: dto.to,
          templateCode: dto.template,
          variables: { variables: dto.variables ?? [] },
        });
      } else if (persist) {
        await this.messageRepo.save({
          channel: 'WHATSAPP',
          toAddress: dto.to,
          templateCode: dto.template,
          variables: { variables: dto.variables ?? [] },
          status: 'SENT',
          externalId,
        });
      }

      return { externalId, status: 'SENT' as const };
    }

    const url = `${this.graphBase}/${this.waVersion}/${WA_PHONE_NUMBER_ID}/messages`;

    try {
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

      this.logger.debug(`WA template → POST ${url} payload=${JSON.stringify(payload)}`);

      const res = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${WA_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const externalId = res.data?.messages?.[0]?.id ?? `wa_${Date.now()}`;
      this.logger.log(`WA template OK to=${dto.to} externalId=${externalId}`);

      if (dto.messageId) {
        await this.messageRepo.updateById(dto.messageId, {
          status: 'SENT',
          externalId,
          toAddress: dto.to,
          templateCode: dto.template,
          variables: { variables: dto.variables ?? [] },
        });
      } else if (persist) {
        await this.messageRepo.save({
          channel: 'WHATSAPP',
          toAddress: dto.to,
          templateCode: dto.template,
          variables: { variables: dto.variables ?? [] },
          status: 'SENT',
          externalId,
        });
      }

      return { externalId, status: 'SENT' as const };
    } catch (err: any) {
      const urlTried = err?.config?.url || url;
      const status = err?.response?.status;
      const data = err?.response?.data;
      const code = err?.code;
      const msg = err?.message;
      this.logger.error(
        `WA template error: code=${code} status=${status} url=${urlTried} msg=${msg} resp=${JSON.stringify(
          data,
        )}`,
      );
      throw new InternalServerErrorException('No se pudo enviar WhatsApp (template)');
    }
  }

  // ============================================================
  // WHATSAPP TEXTO (opcional)
  // ============================================================
  async sendWhatsappText(
    dto: { to: string; text: string; messageId?: string },
    opts?: { persist?: boolean },
  ) {
    const persist = opts?.persist !== false;
    const { WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN } = process.env as any;

    // --- SIMULACIÓN
    if (!WA_PHONE_NUMBER_ID || !WA_ACCESS_TOKEN) {
      this.logger.log(`[SIM] WA text → to=${dto.to} text=${dto.text}`);
      const externalId = `wa_${Date.now()}`;

      if (dto.messageId) {
        await this.messageRepo.updateById(dto.messageId, {
          status: 'SENT',
          externalId,
          toAddress: dto.to,
          variables: { text: dto.text },
        });
      } else if (persist) {
        await this.messageRepo.save({
          channel: 'WHATSAPP',
          toAddress: dto.to,
          variables: { text: dto.text },
          status: 'SENT',
          externalId,
        });
      }
      return { externalId, status: 'SENT' as const };
    }

    const url = `${this.graphBase}/${this.waVersion}/${WA_PHONE_NUMBER_ID}/messages`;
    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: dto.to,
        type: 'text',
        text: { body: dto.text },
      };

      this.logger.debug(`WA text → POST ${url} payload=${JSON.stringify(payload)}`);

      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${WA_ACCESS_TOKEN}` },
        timeout: 15000,
      });

      const externalId = res.data?.messages?.[0]?.id ?? `wa_${Date.now()}`;
      this.logger.log(`WA text OK to=${dto.to} externalId=${externalId}`);

      if (dto.messageId) {
        await this.messageRepo.updateById(dto.messageId, {
          status: 'SENT',
          externalId,
          toAddress: dto.to,
          variables: { text: dto.text },
        });
      } else if (persist) {
        await this.messageRepo.save({
          channel: 'WHATSAPP',
          toAddress: dto.to,
          variables: { text: dto.text },
          status: 'SENT',
          externalId,
        });
      }
      return { externalId, status: 'SENT' as const };
    } catch (e: any) {
      const urlTried = e?.config?.url || url;
      const status = e?.response?.status;
      const data = e?.response?.data;
      const code = e?.code;
      const msg = e?.message;
      this.logger.error(
        `WA text error: code=${code} status=${status} url=${urlTried} msg=${msg} resp=${JSON.stringify(
          data,
        )}`,
      );
      throw new InternalServerErrorException('No se pudo enviar WA text');
    }
  }

  // ============================================================
  // EMAIL
  // ============================================================
  async sendEmail(
    dto: { to: string; subject: string; text?: string; html?: string; messageId?: string },
    opts?: { persist?: boolean },
  ) {
    const persist = opts?.persist !== false;

    // --- SIMULACIÓN
    if (!process.env.SMTP_HOST) {
      this.logger.log(`[SIM] Email → to=${dto.to} subject=${dto.subject}`);
      const messageId = `mail_${Date.now()}`;

      if (dto.messageId) {
        await this.messageRepo.updateById(dto.messageId, {
          status: 'SENT',
          externalId: messageId,
          toAddress: dto.to,
          variables: { subject: dto.subject, text: dto.text, html: dto.html },
        });
      } else if (persist) {
        await this.messageRepo.save({
          channel: 'EMAIL',
          toAddress: dto.to,
          variables: { subject: dto.subject, text: dto.text, html: dto.html },
          status: 'SENT',
          externalId: messageId,
        });
      }

      return { messageId, status: 'SENT' as const };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Cobranzas" <${process.env.SMTP_USER || 'noreply@example.com'}>`,
        to: dto.to,
        subject: dto.subject,
        text: dto.text,
        html: dto.html,
      });
      this.logger.log(`Email OK → ${dto.to} (id: ${info.messageId})`);

      if (dto.messageId) {
        await this.messageRepo.updateById(dto.messageId, {
          status: 'SENT',
          externalId: info.messageId,
          toAddress: dto.to,
          variables: { subject: dto.subject, text: dto.text, html: dto.html },
        });
      } else if (persist) {
        await this.messageRepo.save({
          channel: 'EMAIL',
          toAddress: dto.to,
          variables: { subject: dto.subject, text: dto.text, html: dto.html },
          status: 'SENT',
          externalId: info.messageId,
        });
      }

      return { messageId: info.messageId, status: 'SENT' as const };
    } catch (err: any) {
      this.logger.error(`Email error: ${err?.message || err}`);
      throw new InternalServerErrorException('No se pudo enviar Email');
    }
  }

  // ============================================================
  // SMS
  // ============================================================
  async sendSms(
    dto: { to: string; message: string; messageId?: string },
    opts?: { persist?: boolean },
  ) {
    const persist = opts?.persist !== false;

    // --- Override Axios (WireMock) ---
    if (
      this.twilioBase &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      this.twilioFrom
    ) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID!;
      const token = process.env.TWILIO_AUTH_TOKEN!;
      const url = `${this.twilioBase}/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const body = new URLSearchParams();
      body.append('To', dto.to);
      body.append('From', this.twilioFrom);
      body.append('Body', dto.message);

      const auth = Buffer.from(`${accountSid}:${token}`).toString('base64');

      try {
        this.logger.debug(`SMS (Axios) → POST ${url} body=${body.toString()}`);
        const res = await axios.post(url, body.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${auth}`,
          },
          timeout: 15000,
        });

        const sid = res.data?.sid ?? `sms_${Date.now()}`;
        const status = res.data?.status ?? 'queued';
        const normalized = (String(status).toUpperCase() === 'DELIVERED' ? 'DELIVERED' : 'SENT') as
          | 'DELIVERED'
          | 'SENT';

        if (dto.messageId) {
          await this.messageRepo.updateById(dto.messageId, {
            channel: 'SMS',
            toAddress: dto.to,
            variables: { body: dto.message },
            status: normalized,
            externalId: sid,
          });
        } else if (persist) {
          await this.messageRepo.save({
            channel: 'SMS',
            toAddress: dto.to,
            variables: { body: dto.message },
            status: normalized,
            externalId: sid,
          });
        }

        this.logger.log(`SMS OK to=${dto.to} sid=${sid} status=${status}`);
        return { sid, status };
      } catch (err: any) {
        const urlTried = err?.config?.url || url;
        const status = err?.response?.status;
        const data = err?.response?.data;
        const code = err?.code;
        const msg = err?.message;
        this.logger.error(
          `SMS error (Axios): code=${code} status=${status} url=${urlTried} msg=${msg} resp=${JSON.stringify(
            data,
          )}`,
        );
        throw new InternalServerErrorException('No se pudo enviar SMS');
      }
    }

    // --- Twilio SDK o SIM ---
    if (!this.twilio.accountSid || !this.twilioFrom) {
      this.logger.log(`[SIM] SMS → to=${dto.to} msg=${dto.message}`);
      const sid = `sms_${Date.now()}`;

      if (dto.messageId) {
        await this.messageRepo.updateById(dto.messageId, {
          channel: 'SMS',
          toAddress: dto.to,
          variables: { body: dto.message },
          status: 'SENT',
          externalId: sid,
        });
      } else if (persist) {
        await this.messageRepo.save({
          channel: 'SMS',
          toAddress: dto.to,
          variables: { body: dto.message },
          status: 'SENT',
          externalId: sid,
        });
      }

      return { sid, status: 'SENT' as const };
    }

    try {
      const msg = await this.twilio.messages.create({
        from: this.twilioFrom,
        to: dto.to,
        body: dto.message,
      });
      const sid = msg.sid;
      const status = (msg.status as string) ?? 'queued';
      const normalized = (String(status).toUpperCase() === 'DELIVERED' ? 'DELIVERED' : 'SENT') as
        | 'DELIVERED'
        | 'SENT';

      if (dto.messageId) {
        await this.messageRepo.updateById(dto.messageId, {
          channel: 'SMS',
          toAddress: dto.to,
          variables: { body: dto.message },
          status: normalized,
          externalId: sid,
        });
      } else if (persist) {
        await this.messageRepo.save({
          channel: 'SMS',
          toAddress: dto.to,
          variables: { body: dto.message },
          status: normalized,
          externalId: sid,
        });
      }

      return { sid, status };
    } catch (err: any) {
      this.logger.error(`SMS error (SDK): ${err?.message || err}`);
      throw new InternalServerErrorException('No se pudo enviar SMS');
    }
  }

  // ============================================================
  // UPDATE por externalId (webhooks WA/Twilio)
  // ============================================================
  async updateStatusByExternalId(
    channel: Channel,
    externalId: string,
    providerStatus: string,
    payload?: any,
  ) {
    const next = (() => {
      const v = (providerStatus || '').toLowerCase();
      if (v === 'read' || v === 'seen') return 'READ';
      if (v === 'delivered') return 'DELIVERED';
      if (v === 'failed' || v === 'undelivered') return 'FAILED';
      return 'SENT';
    })();

    const id = (externalId || '').trim();
    const current = await this.messageRepo.findByExternalId(channel, id);
    if (!current) {
      const fallback = await this.messageRepo.findByExternalIdAnyChannel(id);
      if (!fallback) {
        this.logger.warn(`[UPDATE-STATUS] no message found for id=${id}`);
        return;
      }
      await this.messageRepo.updateById(fallback.id, {
        status: next,
        providerPayload: payload ?? fallback.providerPayload,
        lastProviderStatus: providerStatus,
        lastProviderStatusAt: new Date(),
      });
      this.logger.log(`[UPDATE-STATUS] (fallback) id=${id} provider="${providerStatus}" → ${next}`);
      return;
    }

    if (current.status !== next || current.lastProviderStatus !== providerStatus) {
      await this.messageRepo.updateById(current.id, {
        status: next,
        providerPayload: payload ?? current.providerPayload,
        lastProviderStatus: providerStatus,
        lastProviderStatusAt: new Date(),
      });
      this.logger.log(
        `[UPDATE-STATUS] id=${id} provider="${providerStatus}" ${current.status} → ${next}`,
      );
    }
  }
}
