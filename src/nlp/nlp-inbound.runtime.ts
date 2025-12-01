// file: src/jobs/runtimes/nlp-inbound.runtime.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Job, Processor } from 'bullmq';

import { JobsService } from '../jobs/jobs.service';
import { Q_NLP_INBOUND, Q_MESSAGE_SEND, NlpInboundJob } from '../jobs/queues';
import { CasesService } from '../cases/cases.service';
import { NlpService } from '../nlp/nlp.service';

const AUTOREPLY_COOLDOWN_MIN = 120; // 2h

@Injectable()
export class NlpInboundRuntime implements OnModuleInit {
  private readonly logger = new Logger(NlpInboundRuntime.name);

  constructor(
    private readonly jobs: JobsService,
    private readonly ds: DataSource,
    private readonly cases: CasesService,
    private readonly nlp: NlpService,
  ) {}

  async onModuleInit() {
    const processor: Processor<NlpInboundJob> = async (job: Job<NlpInboundJob>) => {
      const j = job.data;

      // 0) idempotencia por external_id (si viene)
      if (j.providerId) {
        const dup = await this.ds.query(`SELECT 1 FROM replies WHERE external_id = $1 LIMIT 1`, [
          j.providerId,
        ]);
        if (dup?.length) return;
      }

      // 1) contexto (caseId, tenantId)
      const ctx = await this.resolveContext(j);
      if (!ctx?.caseId || !ctx?.tenantId) {
        // guardamos huérfano para auditoría y salimos
        await this.ds.query(
          `INSERT INTO replies (case_id, contact_id, channel, text, external_id, received_at)
           VALUES (NULL, NULL, $1, $2, $3, $4)`,
          [j.channel, j.text, j.providerId ?? null, new Date(j.timestamp ?? Date.now())],
        );
        this.logger.warn(`Inbound sin contexto (from=${j.from})`);
        return;
      }
      const caseId = ctx.caseId;
      const tenantId = Number(ctx.tenantId);

      // 2) NLP
      const res = this.nlp.classify(j.text); // { intent, amount?, date? }

      // 3) persistir reply
      await this.ds.query(
        `INSERT INTO replies (case_id, contact_id, channel, text, intent, external_id, received_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          caseId,
          ctx.contactId ?? null,
          j.channel,
          j.text,
          res.intent,
          j.providerId ?? null,
          new Date(j.timestamp ?? Date.now()),
        ],
      );

      // 4) marcar inbound en caso
      await this.cases.markInbound(caseId);

      // 5) efectos por intent
      switch (res.intent) {
        case 'BAJA': {
          if (j.from) {
            await this.ds.query(
              `UPDATE contacts
                  SET dnc = true, updated_at = now()
                WHERE phone = $1 OR email = $1`,
              [j.from],
            );
          }
          await this.maybeAutoReply({
            tenantId,
            caseId,
            to: j.from,
            channel: j.channel,
            templateCode: 'AUTO_BAJA_OK',
            variables: { name: ctx.contactName ?? '' },
            fallbackText: 'Hemos registrado tu baja. No volverás a recibir mensajes.',
          });
          break;
        }
        case 'PTP': {
          const promisedAmount =
            typeof res.amount === 'number' && isFinite(res.amount) ? res.amount.toFixed(2) : null;
          const promisedDate = res.date ?? null;
          await this.ds.query(
            `INSERT INTO ptp (case_id, promised_date, promised_amount, status, source)
             VALUES ($1, $2, $3, 'OPEN', 'AI')`,
            [caseId, promisedDate, promisedAmount],
          );
          await this.maybeAutoReply({
            tenantId,
            caseId,
            to: j.from,
            channel: j.channel,
            templateCode: 'AUTO_PTP_OK',
            variables: {
              amount: promisedAmount ?? '',
              dueDate: promisedDate ?? '',
              name: ctx.contactName ?? '',
            },
            fallbackText: '¡Gracias! Registramos tu promesa de pago.',
          });
          break;
        }
        case 'PAGO': {
          await this.maybeAutoReply({
            tenantId,
            caseId,
            to: j.from,
            channel: j.channel,
            templateCode: 'AUTO_PAGO_OK',
            variables: { name: ctx.contactName ?? '' },
            fallbackText: 'Gracias. Estamos validando tu pago.',
          });
          break;
        }
        case 'CONSULTA': {
          await this.maybeAutoReply({
            tenantId,
            caseId,
            to: j.from,
            channel: j.channel,
            templateCode: 'AUTO_HELP',
            variables: { name: ctx.contactName ?? '' },
            fallbackText: 'Hola, te enviamos la info para pagar o hablar con un asesor.',
          });
          break;
        }
        default:
          // sin acción
          break;
      }
    };

    this.jobs.createWorker<NlpInboundJob>(Q_NLP_INBOUND, processor, { concurrency: 8 });
  }

  /** Busca case/tenant/contact por último OUT a "from" o por contacto->case OPEN */
  private async resolveContext(j: NlpInboundJob) {
    // 1) si ya viene case/tenant => listo
    if (j.caseId && j.tenantId) {
      const c = await this.ds.query(
        `SELECT c.id AS case_id, c.tenant_id, ct.id AS contact_id, ct.full_name
           FROM cases c
           LEFT JOIN contacts ct ON ct.id = c.contact_id OR ct.id = c."contactId"
          WHERE c.id = $1
          LIMIT 1`,
        [j.caseId],
      );
      const k = c?.[0];
      if (k) {
        return {
          caseId: String(k.case_id),
          tenantId: Number(k.tenant_id),
          contactId: k.contact_id ? String(k.contact_id) : undefined,
          contactName: k.full_name ?? undefined,
        };
      }
    }

    // 2) último mensaje OUT a "from"
    const m = await this.ds.query(
      `SELECT m.case_id, c.tenant_id, ct.id AS contact_id, ct.full_name
         FROM messages m
         LEFT JOIN cases c ON c.id = m.case_id
         LEFT JOIN contacts ct ON ct.id = c.contact_id OR ct.id = c."contactId"
        WHERE m.to_address = $1
        ORDER BY m.created_at DESC
        LIMIT 1`,
      [j.from],
    );
    if (m?.[0]?.case_id) {
      return {
        caseId: String(m[0].case_id),
        tenantId: Number(m[0].tenant_id),
        contactId: m[0].contact_id ? String(m[0].contact_id) : undefined,
        contactName: m[0].full_name ?? undefined,
      };
    }

    // 3) contacto por phone/email -> case OPEN
    const ct = await this.ds.query(
      `SELECT id FROM contacts WHERE phone = $1 OR email = $1 LIMIT 1`,
      [j.from],
    );
    if (ct?.[0]?.id) {
      const k = await this.ds.query(
        `SELECT c.id AS case_id, c.tenant_id, ct.full_name
           FROM cases c
           LEFT JOIN contacts ct ON ct.id = c.contact_id OR ct.id = c."contactId"
          WHERE (c.contact_id = $1 OR c."contactId" = $1) AND c.status = 'OPEN'
          ORDER BY c.created_at DESC
          LIMIT 1`,
        [ct[0].id],
      );
      if (k?.[0]?.case_id) {
        return {
          caseId: String(k[0].case_id),
          tenantId: Number(k[0].tenant_id),
          contactId: String(ct[0].id),
          contactName: k[0].full_name ?? undefined,
        };
      }
    }

    return undefined;
  }

  /** respeta cooldown y encola a Q_MESSAGE_SEND */
  private async maybeAutoReply(args: {
    tenantId: number;
    caseId: string;
    to: string;
    channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
    templateCode: string;
    variables: Record<string, string>;
    fallbackText: string;
  }) {
    const meta = (
      await this.ds.query(`SELECT last_inbound_at, last_contacted_at FROM cases WHERE id = $1`, [
        args.caseId,
      ])
    )?.[0];

    const lastTs = Math.max(
      meta?.last_contacted_at ? new Date(meta.last_contacted_at).getTime() : 0,
      meta?.last_inbound_at ? new Date(meta.last_inbound_at).getTime() : 0,
    );
    const diffMin = (Date.now() - lastTs) / 60000;
    if (diffMin < AUTOREPLY_COOLDOWN_MIN) return;

    await this.jobs.addJob(
      Q_MESSAGE_SEND,
      {
        tenantId: args.tenantId,
        caseId: args.caseId,
        channel: args.channel,
        templateCode: args.templateCode,
        variables: args.variables,
        to: args.to,
      },
      { removeOnComplete: true, attempts: 3 },
    );
  }
}
