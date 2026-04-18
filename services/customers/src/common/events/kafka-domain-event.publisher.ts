import { Injectable } from '@nestjs/common';
import { KafkaProducer } from '../kafka/kafka.producer';
import { DomainEvent, IDomainEventPublisher } from './domain-event-publisher';

@Injectable()
export class KafkaDomainEventPublisher implements IDomainEventPublisher {
  constructor(private readonly producer: KafkaProducer) {}

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    await this.producer.emit(event.name, event.aggregateId, event.payload);
  }
}
