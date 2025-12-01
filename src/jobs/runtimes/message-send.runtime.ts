import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Processor } from 'bullmq';
import { DataSource } from 'typeorm';

import { JobsService } from '../../jobs/jobs.service';
import { CasesService } from '../../cases/cases.service';
import { MessagingService } from '../../messaging/messaging.service';
import { TemplatesService } from '../../messaging/templates.service';
import { Q_MESSAGE_SEND, MessageSendJob } from '../../jobs/queues';
import { Message } from '../../entities/message.entity';

@Injectable()
export class MessageSendRuntime implements OnModuleInit {
  private readonly logger = new Logger(MessageSendRuntime.name);

  constructor(
    private readonly jobs: JobsService,
    private readonly ds: DataSource,
    private readonly cases: CasesService,
    private readonly messaging: MessagingService,
    private readonly templates: TemplatesService,
  ) {}

  async onModuleInit() {
    const processor: Processor<MessageSendJob> = async (job: Job<MessageSendJob>) => {
      // --- 0) Cargar payload (por messageId o full) ---
      const repo = this.ds.getRepository(Message);

      let channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
      let to: string;
      let templateCode: string | undefined;
      let variables: Record<string, any> = {};
      let caseId: string | undefined;
      let messageRow: Message | any;

      if ('messageId' in job.data) {
        // Forma A (preferida): usar el message ya persistido (status=QUEUED)
        messageRow = await repo.findOne({ where: { id: job.data.messageId } });
        if (!messageRow) {
          this.logger.warn(`message-send: no existe message ${job.data.messageId}`);
          return;
        }
        channel = messageRow.channel as any;
        to = messageRow.toAddress!;
        templateCode = messageRow.templateCode!;
        variables = messageRow.variables || {};
        caseId = messageRow.caseId;
      } else {
        // Forma B: payload completo → persistimos para que haya log
        channel = job.data.channel;
        to = job.data.to;
        templateCode = job.data.templateCode;
        variables = job.data.variables || {};
        caseId = job.data.caseId;

        messageRow = await repo.save(
          repo.create({
            caseId,
            channel,
            templateCode,
            variables,
            status: 'QUEUED',
            toAddress: to,
          }),
        );
      }

      // --- 1) Render de template (solo aplica a EMAIL/SMS, WA usa templateCode HSM) ---
      const { subject, body } = this.templates.render(
        templateCode || '',
        channel,
        Object.fromEntries(Object.entries(variables).map(([k, v]) => [k, String(v ?? '')])),
      );

      // --- 2) Intentar envío por canal (sin persistir dentro del service) ---
      let externalId = '';
      try {
        if (channel === 'WHATSAPP') {
          const wa = await this.messaging.sendWhatsappTemplate(
            {
              to,
              template: templateCode || '',
              // Para WA HSM: variables como array en orden
              variables:
                Array.isArray(variables?.variables) && variables.variables.length
                  ? variables.variables
                  : Object.values(variables || {}),
            },
            { persist: false }, // 👈 evita duplicados
          );
          externalId = wa.externalId || '';
        } else if (channel === 'SMS') {
          const sms = await this.messaging.sendSms(
            { to, message: body || variables?.body || variables?.text || '' },
            { persist: false }, // 👈 evita duplicados
          );
          externalId = sms.sid || '';
        } else {
          const email = await this.messaging.sendEmail(
            {
              to,
              subject: subject || variables?.subject || 'Recordatorio de pago',
              text: body || variables?.text,
              html: variables?.html,
            },
            { persist: false }, // 👈 evita duplicados
          );
          externalId = (email as any).messageId || '';
        }

        // --- 3) Actualizar la MISMA fila (QUEUED → SENT) ---
        await repo.update({ id: messageRow.id }, {
          status: 'SENT',
          externalId: externalId || messageRow.externalId,
          updatedAt: () => 'NOW()',
        } as any);

        // --- 4) Marcar último contacto del caso ---
        if (caseId) {
          try {
            await this.cases.markContacted(caseId);
          } catch (e) {
            this.logger.warn(
              `No se pudo marcar contacted para case ${caseId}: ${(e as Error).message}`,
            );
          }
        }
      } catch (err: any) {
        this.logger.error(`Error enviando mensaje ${messageRow.id}: ${err?.message || err}`);
        await repo.update({ id: messageRow.id }, {
          status: 'FAILED',
          updatedAt: () => 'NOW()',
        } as any);
        throw err; // que reintente según attempts/backoff
      }
    };

    this.jobs.createWorker<MessageSendJob>(Q_MESSAGE_SEND, processor, { concurrency: 10 });
  }
}
