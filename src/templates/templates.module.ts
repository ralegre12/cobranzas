// file: src/templates/templates.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MessageTemplate } from '../entities/message-template.entity';
import { TemplateService } from './template.service';
import { TemplatesController } from './templates.controller';
import { RedisModule } from '../shared/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([MessageTemplate]), RedisModule],
  providers: [TemplateService],
  controllers: [TemplatesController],
  exports: [TemplateService],
})
export class TemplatesModule {}
