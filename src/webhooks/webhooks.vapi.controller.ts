import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from '../payments/payments.service';

@ApiTags('vapi')
@Controller('webhooks/vapi')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class WebhooksVapiController {
  constructor(private readonly payments: PaymentsService) {}

  @HttpCode(200)
  @Post()
  async handle(@Headers('x-vapi-signature') signature: string | undefined, @Body() payload: any) {
    const expected = process.env.VAPI_WEBHOOK_SECRET;
    if (!expected || signature !== expected) throw new HttpException('Unauthorized', 401);

    // Tool-calls
    if (payload?.message?.type === 'tool-calls') {
      const calls = Array.isArray(payload?.message?.toolCalls) ? payload.message.toolCalls : [];
      const results = await Promise.all(
        calls.map(async (c: any) => {
          try {
            switch (c?.name) {
              case 'createPaymentLink': {
                // ajustar a tu forma: caseId, amount, title, currency
                const { caseId, amount, title, currency } = c?.args ?? {};
                const out = await this.payments.createPaymentLink({
                  caseId,
                  amount,
                  title,
                  currency,
                });
                return { toolCallId: c.toolCallId, result: out };
              }
              default:
                return { toolCallId: c?.toolCallId, error: 'Unknown tool' };
            }
          } catch (e: any) {
            return { toolCallId: c?.toolCallId, error: e?.message || 'tool error' };
          }
        }),
      );
      return { results };
    }

    return { ok: true };
  }
}
