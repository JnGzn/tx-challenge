import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KAFKA_PRODUCER } from './topics';
import { KafkaProducer } from './kafka.producer';
import { IdempotencyService } from './idempotency.service';
import { DlqService } from './dlq.service';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_PRODUCER,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: `${config.getOrThrow<string>('KAFKA_CLIENT_ID')}-producer`,
              brokers: config
                .getOrThrow<string>('KAFKA_BROKERS')
                .split(',')
                .map((b) => b.trim())
            },
            producer: {
              allowAutoTopicCreation: true,
              idempotent: true
            }
          }
        })
      }
    ])
  ],
  providers: [KafkaProducer, IdempotencyService, DlqService],
  exports: [KafkaProducer, IdempotencyService, DlqService]
})
export class KafkaModule {}
