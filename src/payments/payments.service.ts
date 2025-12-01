import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import type { PreferenceResponse } from 'mercadopago/dist/clients/preference/commonTypes';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment as PaymentEntity } from '../entities/payment.entity';
import { DataSource } from 'typeorm';
import { JobsService } from '../jobs/jobs.service';
import { Q_MESSAGE_SEND } from '../jobs/queues';
import { CasesService } from '../cases/cases.service';

type CreatePaymentLinkParams = {
  caseId: string;
  amount: number | string;
  title?: string;
  currency?: string; // 'ARS' default
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly ds: DataSource,
    @InjectRepository(PaymentEntity)
    private readonly payRepo: Repository<PaymentEntity>,
    private readonly jobs: JobsService,
    private readonly cases: CasesService,
  ) {}

  async createPaymentLink(params: CreatePaymentLinkParams) {
    const token = process.env.MP_ACCESS_TOKEN;

    // Usa MP_WEBHOOK_PUBLIC_URL si está seteada; si no, fallback al path real del controller
    const notificationUrl =
      process.env.MP_WEBHOOK_PUBLIC_URL ??
      'http://localhost:3000/api/payments/webhooks/mercadopago'; // 👈 ruta real por defecto

    // Simulación si no hay credenciales
    if (!token) {
      const preferenceId = 'pref_' + Date.now();
      return { url: `https://mpago.la/${preferenceId}`, preferenceId };
    }

    try {
      const client = new MercadoPagoConfig({ accessToken: token });
      const preferenceClient = new Preference(client);

      const pref: PreferenceResponse = await preferenceClient.create({
        body: {
          items: [
            {
              id: params.caseId,
              title: params.title ?? 'Cobranza',
              quantity: 1,
              currency_id: (params.currency ?? 'ARS') as any,
              unit_price: Number(params.amount),
            },
          ],
          notification_url: notificationUrl,
          // 👇 redundancia útil para reconciliar
          external_reference: params.caseId,
          metadata: { caseId: params.caseId },
          back_urls: {
            success: process.env.MP_BACK_URL_SUCCESS ?? '',
            pending: process.env.MP_BACK_URL_PENDING ?? '',
            failure: process.env.MP_BACK_URL_FAILURE ?? '',
          },
          auto_return: 'approved',
        },
      });

      return {
        url: pref.init_point ?? pref.sandbox_init_point ?? '',
        preferenceId: pref.id ?? '',
        raw: pref,
      };
    } catch (err: any) {
      this.logger.error('[MP Preference Error] ' + (err?.message || err));
      throw new InternalServerErrorException('No se pudo crear la preferencia de pago');
    }
  }

  async handleMpNotification(payload: any) {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      this.logger.log('[SIM] handleMpNotification sin token, noop');
      return { ok: true, simulated: true };
    }

    const paymentId =
      payload?.data?.id ||
      payload?.resource ||
      payload?.id ||
      payload?.resourceId ||
      payload?.data?.resourceId;

    const type = (payload?.type || payload?.topic || '').toString().toLowerCase();

    if (!paymentId) {
      this.logger.warn('[MP] webhook sin paymentId identificable');
      return { ok: true, ignored: true };
    }

    if (type && type !== 'payment') {
      this.logger.log(`[MP] notificación tipo ${type} (ignorada por ahora)`);
      return { ok: true, ignored: true, type };
    }

    await this.reconcilePaymentById(String(paymentId));
    return { ok: true };
  }

  async reconcilePaymentById(mpPaymentId: string) {
    const token = process.env.MP_ACCESS_TOKEN!;
    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentsClient = new Payment(client);

    const res: any = await paymentsClient.get({ id: mpPaymentId as any });

    const status: string = res?.status ?? '';
    const amount: number = Number(res?.transaction_amount ?? 0);

    const preferenceId: string | undefined =
      res?.order?.id || res?.metadata?.preference_id || res?.additional_info?.ip_address;

    const caseId: string | undefined =
      res?.metadata?.caseId || res?.external_reference || res?.additional_info?.items?.[0]?.id;

    const existing = await this.payRepo.findOne({
      where: { paymentId: mpPaymentId },
    });

    const entity: any = existing
      ? { ...existing }
      : {
          provider: 'MP',
          paymentId: mpPaymentId,
          mpPaymentId: mpPaymentId,
          case: caseId ? ({ id: caseId } as any) : null,
        };

    entity.preferenceId = preferenceId ?? entity.preferenceId;
    entity.amount = amount ?? entity.amount;
    entity.status = mapMpStatus(status);
    if (['approved', 'accredited'].includes(entity.status) && !entity.accreditedAt) {
      entity.accreditedAt = new Date();
    }

    entity.metadata = {
      ...(existing?.metadata ?? {}),
      payer: res?.payer,
      payment_method: res?.payment_method_id,
      installments: res?.installments,
      order: res?.order,
      raw: res,
    };

    const saved = await this.payRepo.save(this.payRepo.create(entity));

    // Post-approve hooks
    try {
      if (['approved', 'accredited'].includes(entity.status) && caseId) {
        await this.notifyPaymentApproved(caseId, amount);
        await this.cases.closeIfZero(caseId);
        await this.cases.reopenIfPositive(caseId);
      }
    } catch (e) {
      this.logger.warn('Post-approve hooks fallaron: ' + (e as Error).message);
    }

    return saved;
  }

  private async notifyPaymentApproved(caseId: string, amount: number) {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      const kase = await qr.query(
        `SELECT 
          c.id, c.tenant_id,
          ct.phone, ct.email, COALESCE(ct.full_name, ct."fullName") AS full_name
       FROM cases c
       LEFT JOIN contacts ct ON ct.id = c.contact_id         -- 👈 usar contact_id
       WHERE c.id = $1
       LIMIT 1`,
        [caseId],
      );
      const k = kase?.[0];
      if (!k) return;

      const tenantId: number = Number(k.tenant_id);
      const vars = {
        name: k.full_name ?? '',
        amount: amount.toFixed(2),
      };

      if (k.phone) {
        await this.jobs.addJob(
          Q_MESSAGE_SEND,
          {
            tenantId,
            caseId,
            channel: 'WHATSAPP',
            templateCode: 'PAYMENT_CONFIRMED',
            variables: vars,
            to: k.phone,
          },
          { removeOnComplete: true, attempts: 3 },
        );
      } else if (k.email) {
        await this.jobs.addJob(
          Q_MESSAGE_SEND,
          {
            tenantId,
            caseId,
            channel: 'EMAIL',
            templateCode: 'PAYMENT_CONFIRMED',
            variables: vars,
            to: k.email,
          },
          { removeOnComplete: true, attempts: 3 },
        );
      }
    } finally {
      await qr.release();
    }
  }
}

function mapMpStatus(s: string): string {
  switch ((s || '').toLowerCase()) {
    case 'approved':
    case 'accredited': // 👈 mapeo adicional
      return 'approved';
    case 'authorized':
      return 'authorized';
    case 'in_process':
      return 'in_process';
    case 'rejected':
      return 'rejected';
    case 'refunded':
      return 'refunded';
    case 'charged_back':
      return 'charged_back';
    default:
      return s || 'unknown';
  }
}
