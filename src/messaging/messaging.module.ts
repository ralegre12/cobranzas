import { forwardRef, Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { WhatsappController } from './whatsapp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '@entities/message.entity';
import { HttpModule } from '@nestjs/axios';
import { MailController } from './mail.controller';
import { SmsController } from './sms.controller';
import { MessageRepository } from './message.repository';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { MessagingLogsController } from './messaging.logs.controller';
import { MessagingImportService } from './messaging-import.service';
import { MessagingImportController } from './import.controller';
import { JobsModule } from '../jobs/jobs.module';

// 👇 IMPORTAR EL SERVICE
import { TemplatesService } from './templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([Message]), HttpModule, forwardRef(() => JobsModule)],
  controllers: [
    WhatsappController,
    SmsController,
    MailController,
    MessagingLogsController,
    MessagingImportController,
  ],
  providers: [
    MessagingService,
    MessageRepository,
    ApiKeyGuard,
    MessagingImportService,
    TemplatesService, // 👈 AÑADIR
  ],
  exports: [
    MessagingService,
    TemplatesService, // 👈 EXPORTAR
  ],
})
export class MessagingModule {}
