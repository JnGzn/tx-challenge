import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { PrismaTransactionRepository } from './infrastructure/prisma-transaction.repository';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository }
  ],
  exports: [TransactionsService, TRANSACTION_REPOSITORY]
})
export class TransactionsModule {}
