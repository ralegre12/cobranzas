// src/messaging/mail.controller.ts
import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { SendEmailDto } from './dto/send-email.dto';

@ApiTags('messaging/mail')
@Controller('messaging/mail')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MailController {
  constructor(private readonly messaging: MessagingService) {}

  @Post()
  @ApiBody({ type: SendEmailDto })
  sendEmail(@Body() dto: SendEmailDto) {
    return this.messaging.sendEmail(dto);
  }
}
