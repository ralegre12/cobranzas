// file: scripts/seed.ts
import 'reflect-metadata';
import dataSource from 'src/shared/orm.datasource';
import { randomBytes } from 'crypto';

async function main() {
  await dataSource.initialize();

  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    // 1) Tenant demo
    const tenantName = process.env.SEED_TENANT_NAME ?? 'DemoCo';
    const apiKey = randomBytes(24).toString('hex');

    const tenant = await qr.query(
      `INSERT INTO tenants (name, api_key) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET api_key = EXCLUDED.api_key
       RETURNING id, api_key`,
      [tenantName, apiKey],
    );
    const tenantId = tenant[0].id as string;

    // 2) Templates base
    const templates = [
      {
        channel: 'WHATSAPP',
        code: 'WA_FIRST_REMINDER',
        name: 'Primer recordatorio',
        body: 'Hola {{name}}, te recordamos que adeudás {{amount}} con ref {{reference}}. Pagá aquí: {{payUrl}}',
        variables: ['name', 'amount', 'reference', 'payUrl'],
        is_approved: true,
      },
      {
        channel: 'WHATSAPP',
        code: 'PAYMENT_CONFIRMED',
        name: 'Pago confirmado',
        body: '¡Gracias {{name}}! Confirmamos tu pago de {{amount}}.',
        variables: ['name', 'amount'],
        is_approved: true,
      },
      {
        channel: 'SMS',
        code: 'PAYMENT_LINK',
        name: 'Link de pago',
        body: 'Hola {{name}}, pagá {{amount}} aquí: {{payUrl}}',
        variables: ['name', 'amount', 'payUrl'],
        is_approved: true,
      },
      {
        channel: 'EMAIL',
        code: 'PAYMENT_LINK',
        name: 'Link de pago (email)',
        body: 'Hola {{name}}, podés pagar {{amount}} con este enlace: {{payUrl}}',
        variables: ['name', 'amount', 'payUrl'],
        is_approved: true,
      },
    ];

    for (const t of templates) {
      await qr.query(
        `INSERT INTO message_templates (channel, name, body, variables, locale, provider_name, is_approved)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT DO NOTHING`,
        [t.channel, t.name, t.body, t.variables, 'es_AR', null, t.is_approved],
      );
    }

    // 3) Segmento de prueba (IDs de cases abiertos)
    const seg = await qr.query(
      `INSERT INTO segments (name, filter_sql)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        'OPEN_CASES_TOP500',
        `SELECT id FROM cases WHERE status='OPEN' ORDER BY created_at DESC LIMIT 500`,
      ],
    );
    const segmentId =
      (seg[0]?.id as string) || (await qr.query(`SELECT id FROM segments LIMIT 1`))[0].id;

    // 4) Campaña de prueba
    await qr.query(
      `INSERT INTO campaigns (name, segment_id, channel_priority, daily_cap, status, template_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        'Primer contacto',
        segmentId,
        JSON.stringify(['WHATSAPP', 'SMS', 'EMAIL']),
        200,
        'ACTIVE',
        'WA_FIRST_REMINDER',
      ],
    );

    await qr.commitTransaction();

    console.log('Seed OK');
    console.log('Tenant:', tenantName);
    console.log('Tenant ID:', tenantId);
    console.log('API KEY  :', apiKey);
  } catch (e) {
    await qr.rollbackTransaction();
    console.error('Seed failed:', e);
    process.exit(1);
  } finally {
    await qr.release();
    await dataSource.destroy();
  }
}

main();
