import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly service: TransactionsService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    const sanitized: CreateTransactionDto = {
      type: dto.type,
      amount: dto.amount,
      sourceAccountId: dto.sourceAccountId,
      targetAccountId: dto.targetAccountId,
      idempotencyKey: dto.idempotencyKey
    };
    return this.service.request(sanitized);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get()
  list(@Query() query: QueryTransactionsDto) {
    return this.service.list(query);
  }
}
