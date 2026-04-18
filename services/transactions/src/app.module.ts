import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { KafkaModule } from './common/kafka/kafka.module';
import { TransactionsModule } from './transactions/transactions.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    PrismaModule,
    KafkaModule,
    TransactionsModule,
    EventsModule
  ]
})
export class AppModule {}
