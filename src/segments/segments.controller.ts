// file: src/segments/segments.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { SegmentsService } from './segments.service';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { PreviewDto } from './dto/preview.dto';

@ApiTags('segments')
@Controller('tenants/:tenantId/segments')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class SegmentsController {
  constructor(private readonly svc: SegmentsService) {}

  @Get()
  list(@Param('tenantId') tenantId: string) {
    return this.svc.list(tenantId);
  }

  @Get(':id')
  get(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.svc.get(tenantId, id);
  }

  @Post()
  create(@Param('tenantId') tenantId: string, @Body() dto: CreateSegmentDto) {
    return this.svc.create(tenantId, dto);
  }

  @Put(':id')
  update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSegmentDto,
  ) {
    return this.svc.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.svc.remove(tenantId, id);
  }

  @Post('preview')
  @ApiBody({ type: CreateSegmentDto })
  preview(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateSegmentDto,
    @Query() q: PreviewDto,
  ) {
    return this.svc.preview(tenantId, dto.filterSql, q.limit ?? 50);
  }
}
