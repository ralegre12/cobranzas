import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import rawBody from 'fastify-raw-body';
import { AppModule } from './app.module';
import multipart from '@fastify/multipart';

async function bootstrap() {
  const adapter = new FastifyAdapter({ bodyLimit: 5 * 1024 * 1024, logger: true });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);
  const fastify = app.getHttpAdapter().getInstance();

  await fastify.register(multipart as any, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  await fastify.register(rawBody as any, {
    field: 'rawBody',
    encoding: 'utf8',
    runFirst: true,
    global: false,
  });

  fastify.addHook('onRoute', (route) => {
    if (route.url?.startsWith('/api/webhooks/')) {
      route.config = { ...(route.config || {}), rawBody: true };
    }
  });

  const globalPrefix = (process.env.GLOBAL_PREFIX ?? 'api').replace(/^\/+/, '');
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const cfg = new DocumentBuilder()
    .setTitle('Cobranzas API')
    .setDescription('Omnicanal + PTP + Pagos + Voz')
    .setVersion('0.2.0')
    .build();

  const doc = SwaggerModule.createDocument(app, cfg);
  SwaggerModule.setup('docs', app, doc, { useGlobalPrefix: true });

  // CORS
  app.enableCors({
    origin: (_origin, cb) => cb(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-tenant-id',
      'x-hub-signature-256',
      'x-signature',
    ],
  });

  // Puerto dedicado para evitar colisiones
  const port = Number(3015);
  await app.listen({ port, host: '0.0.0.0' });
}
bootstrap();
