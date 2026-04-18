import { Module } from '@nestjs/common';
import { EventsConsumer } from './events.consumer';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [TransactionsModule],
  controllers: [EventsConsumer]
})
export class EventsModule {}
