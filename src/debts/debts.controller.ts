// file: src/debts/debts.controller.ts
import {
  Controller,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DebtsService } from './debts.service';
import { ImportOptionsDto, DateFmt } from './dto/import-options.dto';
import { memoryStorage } from 'multer';
import type { ImportOptions } from './debts.service'; // <- exporta el tipo desde el service

@Controller('tenants/:tenantId/debts')
export class DebtsController {
  constructor(private readonly svc: DebtsService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async import(
    @Param('tenantId') tenantId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(text\/csv|application\/vnd\.ms-excel|text\/plain)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Query() q: ImportOptionsDto,
  ) {
    if (!file) throw new BadRequestException('Falta archivo');

    const opts: ImportOptions = {
      preview: q.preview ?? false,
      dateFmt: q.dateFmt ?? DateFmt.AUTO, // ✅ enum -> coincide con el union del service
      country: q.country ?? 'AR',
      createCase: q.createCase ?? true,
    };

    const res = await this.svc.importCsv(+tenantId, file.buffer, opts);
    return res;
  }
}
