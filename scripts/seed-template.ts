// file: scripts/seed-templates.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { MessageTemplate } from '../src/entities/message-template.entity';
import dataSource from 'src/shared/orm.datasource';

dotenv.config({ path: '.env' });

async function run() {
  const ds: DataSource = await dataSource.initialize();
  const repo = ds.getRepository(MessageTemplate);

  const tenantId = process.env.SEED_TENANT_ID ?? null;

  const base = [
    {
      code: 'WA_FIRST_REMINDER',
      channel: 'WHATSAPP',
      locale: 'es_AR',
      body: 'Hola {{name}}, te recordamos un pago pendiente de {{amount}} con vencimiento {{dueDate}}. Ref: {{reference}}.',
      requiredVars: ['name', 'amount', 'dueDate', 'reference'],
    },
    {
      code: 'PAYMENT_CONFIRMED',
      channel: 'WHATSAPP',
      locale: 'es_AR',
      body: '¡Gracias {{name}}! Registramos tu pago de {{amount}}. 📩',
      requiredVars: ['name', 'amount'],
    },
    {
      code: 'PAYMENT_CONFIRMED',
      channel: 'EMAIL',
      locale: 'es_AR',
      body: '<p>Hola {{name}},</p><p>Registramos tu pago de <strong>{{amount}}</strong>. ¡Gracias!</p>',
      requiredVars: ['name', 'amount'],
    },
  ] as const;

  for (const t of base) {
    const exists = await repo.findOne({
      where: { tenantId, code: t.code, channel: t.channel, locale: t.locale } as any,
    });
    if (!exists) {
      await repo.save(
        repo.create({
          tenantId,
          code: t.code,
          channel: t.channel as any,
          locale: t.locale,
          body: t.body,
          requiredVars: t.requiredVars as any,
          isApproved: true,
          version: 1,
        }),
      );
      // eslint-disable-next-line no-console
      console.log(`Seeded template ${t.channel}:${t.code}`);
    }
  }

  await ds.destroy();
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
