//src/messaging/import.controller.ts
import { BadRequestException, Controller, Post, Req, Param, Logger } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { MessagingImportService } from './messaging-import.service';

@Controller('tenants/:tenantId/messaging/import')
export class MessagingImportController {
  private readonly logger = new Logger(MessagingImportController.name);
  constructor(private readonly svc: MessagingImportService) {}

  @Post('csv')
  async importCsv(@Param('tenantId') tenantId: string, @Req() req: FastifyRequest) {
    if (!((req as any).isMultipart?.() ?? false)) {
      throw new BadRequestException('Content-Type debe ser multipart/form-data');
    }

    let buf: Buffer | null = null;
    let channel: string | undefined;
    let defaultTemplate: string | undefined;

    for await (const part of (req as any).parts()) {
      if (part.type === 'file') {
        if (part.fieldname === 'file' && !buf) {
          // ✅ Consumir el archivo acá mismo
          buf =
            typeof part.toBuffer === 'function'
              ? await part.toBuffer()
              : await (async () => {
                  const chunks: Buffer[] = [];
                  for await (const c of part.file) chunks.push(c);
                  return Buffer.concat(chunks);
                })();
        } else {
          // ✅ Drenar cualquier otro archivo para que el iterador termine
          for await (const _ of part.file) {
            /* drain */
          }
        }
      } else {
        const v = String(part.value ?? '');
        if (part.fieldname === 'channel') channel = v;
        if (part.fieldname === 'defaultTemplate') defaultTemplate = v;
      }
    }

    if (!buf) throw new BadRequestException('file es requerido');

    const CHANNELS = new Set(['WHATSAPP', 'SMS', 'EMAIL']);
    if (!channel || !CHANNELS.has(channel)) {
      throw new BadRequestException('channel inválido (usa WHATSAPP | SMS | EMAIL)');
    }

    // Procesar CSV
    return this.svc.importCsvBuffer(buf, {
      tenantId,
      channel: channel as 'WHATSAPP' | 'SMS' | 'EMAIL',
      defaultTemplate: defaultTemplate ?? 'WA_FIRST_REMINDER',
    });
  }
}
