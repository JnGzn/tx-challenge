import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { KAFKA_PRODUCER } from './topics';

@Injectable()
export class KafkaProducer implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(KAFKA_PRODUCER) private readonly client: ClientKafka) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  async emit<T>(topic: string, key: string, payload: T): Promise<void> {
    await this.client.emit(topic, { key, value: payload }).toPromise();
  }
}
