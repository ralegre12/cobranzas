import { Injectable } from '@nestjs/common';
import { Channel } from '../jobs/queues';

type Template = { code: string; channel: Channel; body: string; subject?: string };

@Injectable()
export class TemplatesService {
  // MVP: templates en memoria (podés llevar a DB después)
  private readonly templates: Template[] = [
    {
      code: 'WA_FIRST_REMINDER',
      channel: 'WHATSAPP',
      body: 'Hola {{name}}! Tenés un saldo de ${{amount}}. Podés pagar acá: {{mpLink}}',
    },
    {
      code: 'AUTO_HELP',
      channel: 'WHATSAPP',
      body: '¿Necesitás ayuda? Respondenos con fecha y monto o pedí el link de pago.',
    },
    {
      code: 'AUTO_PTP_OK',
      channel: 'WHATSAPP',
      body: 'Perfecto, registré tu promesa de pago por ${{amount}} para el {{dueDate}}.',
    },
    {
      code: 'AUTO_DNC_OK',
      channel: 'WHATSAPP',
      body: 'Listo, no volveremos a contactarte por este medio.',
    },
    {
      code: 'AUTO_PAGO_OK',
      channel: 'WHATSAPP',
      body: '¡Gracias! Ya nos figuró tu pago o lo verificaremos en breve.',
    },
    {
      code: 'PAYMENT_CONFIRMED',
      channel: 'WHATSAPP',
      body: '¡Gracias {{name}}! Registramos tu pago de ${{amount}}.',
    },

    {
      code: 'EMAIL_FIRST_REMINDER',
      channel: 'EMAIL',
      subject: 'Recordatorio de pago',
      body: 'Hola {{name}}, saldo ${{amount}}. Pagá acá: {{mpLink}}',
    },
  ];

  render(code: string, channel: Channel, vars: Record<string, string>) {
    const t =
      this.templates.find((x) => x.code === code && x.channel === channel) ||
      this.templates.find((x) => x.code === code);
    if (!t) return { subject: '', body: '' };
    const body = t.body.replace(/{{(\w+)}}/g, (_, k) => vars?.[k] ?? '');
    const subject = (t.subject || '').replace(/{{(\w+)}}/g, (_, k) => vars?.[k] ?? '');
    return { subject, body };
  }
}
