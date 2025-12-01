// file: src/templates/templates.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { RenderDto } from './dto/render.dto';

@Controller('templates')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TemplatesController {
  constructor(private readonly svc: TemplateService) {}

  @Get()
  list(@Query('tenantId') tenantId: string) {
    return this.svc.findAll(tenantId);
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.svc.update(id, dto);
  }

  @Post('render')
  async render(@Body() dto: RenderDto) {
    const text = await this.svc.render(
      dto.tenantId,
      dto.code,
      dto.vars,
      dto.channel,
      dto.locale ?? 'es_AR',
    );
    return { text };
  }

  @Post('renderAll')
  renderAll(@Body() dto: Omit<RenderDto, 'channel'>) {
    return this.svc.renderAll(dto.tenantId, dto.code, dto.vars, dto.locale ?? 'es_AR');
  }
}
