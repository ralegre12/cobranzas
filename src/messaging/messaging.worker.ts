import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { Q_MESSAGE_SEND } from '../jobs/queues';
import { DataSource } from 'typeorm';
import { MessagingService } from './messaging.service';

@Injectable()
export class MessagingWorker implements OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly ds: DataSource,
    private readonly messaging: MessagingService,
  ) {}

  onModuleInit() {
    this.jobs.createWorker(Q_MESSAGE_SEND, async (job) => {
      const { messageId, channel } = job.data || {};
      if (!messageId || !channel) return;

      const msg = (
        await this.ds.query(`SELECT * FROM messages WHERE id = $1 LIMIT 1`, [messageId])
      )?.[0];
      if (!msg) return;

      try {
        if (channel === 'WHATSAPP') {
          await this.messaging.sendWhatsappTemplate({
            to: msg.to_address,
            template: msg.template, // columna 'template' en DB
            variables: msg.payload?.variables ?? [],
            messageId,
          });
        } else if (channel === 'SMS') {
          await this.messaging.sendSms({
            to: msg.to_address,
            message: msg.payload?.body ?? msg.payload?.text ?? '',
            messageId,
          });
        } else if (channel === 'EMAIL') {
          await this.messaging.sendEmail({
            to: msg.to_address,
            subject: msg.payload?.subject ?? 'Recordatorio',
            text: msg.payload?.text,
            html: msg.payload?.html,
            messageId,
          });
        }
      } catch {
        await this.ds.query(
          `UPDATE messages SET status = 'FAILED', updated_at = now() WHERE id = $1`,
          [messageId],
        );
      }
    });
  }
}
