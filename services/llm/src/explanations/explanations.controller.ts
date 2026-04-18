import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ExplanationsService } from './explanations.service';

@Controller('explanations')
export class ExplanationsController {
  constructor(private readonly service: ExplanationsService) {}

  @Get('transaction/:transactionId')
  explainTransaction(@Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.service.explainTransaction(transactionId);
  }

  @Get('account/:accountId/summary')
  summarize(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.service.summarizeAccount(accountId);
  }
}
