// file: src/segments/segments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Segment } from '../entities/segment.entity';
import { SegmentsController } from './segments.controller';
import { SegmentsService } from './segments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Segment])],
  controllers: [SegmentsController],
  providers: [SegmentsService],
  exports: [SegmentsService],
})
export class SegmentsModule {}
