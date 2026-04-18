import { Global, Module } from '@nestjs/common';
import { DOMAIN_EVENT_PUBLISHER } from './domain-event-publisher';
import { KafkaDomainEventPublisher } from './kafka-domain-event.publisher';

@Global()
@Module({
  providers: [
    KafkaDomainEventPublisher,
    { provide: DOMAIN_EVENT_PUBLISHER, useExisting: KafkaDomainEventPublisher }
  ],
  exports: [DOMAIN_EVENT_PUBLISHER]
})
export class DomainEventsModule {}
