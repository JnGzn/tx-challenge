import { Module } from '@nestjs/common';
import { EventsConsumer } from './events.consumer';
import { DepositHandler } from './handlers/deposit.handler';
import { TransferHandler } from './handlers/transfer.handler';
import { WithdrawalHandler } from './handlers/withdrawal.handler';
import { TRANSACTION_HANDLER } from './handlers/transaction-handler';
import { TransactionHandlerRegistry } from './handlers/transaction-handler.registry';

@Module({
  controllers: [EventsConsumer],
  providers: [
    DepositHandler,
    WithdrawalHandler,
    TransferHandler,
    {
      provide: TRANSACTION_HANDLER,
      useFactory: (
        deposit: DepositHandler,
        withdrawal: WithdrawalHandler,
        transfer: TransferHandler
      ) => [deposit, withdrawal, transfer],
      inject: [DepositHandler, WithdrawalHandler, TransferHandler]
    },
    TransactionHandlerRegistry
  ]
})
export class EventsModule {}
