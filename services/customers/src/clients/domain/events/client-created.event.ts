import { DomainEvent } from '../../../common/events/domain-event-publisher';
import { TOPICS } from '../../../common/kafka/topics';

export interface ClientCreatedPayload {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export class ClientCreatedEvent implements DomainEvent<ClientCreatedPayload> {
  readonly name = TOPICS.CLIENT_CREATED;
  constructor(
    readonly aggregateId: string,
    readonly payload: ClientCreatedPayload
  ) {}
}
