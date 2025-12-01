import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NlpService } from './nlp.service';
import { NlpInboundRuntime } from './nlp-inbound.runtime';
import { JobsModule } from '../jobs/jobs.module';
import { TemplatesModule } from '../templates/templates.module';
import { MessagingModule } from '../messaging/messaging.module';

// Entities sólo para metadatos / repos (ajustá rutas si difieren)
import { Case } from '../entities/case.entity';
import { Reply } from '../entities/reply.entity';
import { Message } from '../entities/message.entity';
import { Ptp } from '../entities/ptp.entity';
import { Contact } from '../entities/contact.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Case, Reply, Message, Ptp, Contact]),
    JobsModule,
    TemplatesModule,
    MessagingModule,
  ],
  providers: [NlpService, NlpInboundRuntime],
  exports: [NlpService],
})
export class NlpModule {}
