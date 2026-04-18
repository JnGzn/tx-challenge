import { DomainEvent } from '../../../common/events/domain-event-publisher';
import { TOPICS } from '../../../common/kafka/topics';

export interface AccountCreatedPayload {
  id: string;
  clientId: string;
  number: string;
  balance: string;
  createdAt: string;
}

export class AccountCreatedEvent implements DomainEvent<AccountCreatedPayload> {
  readonly name = TOPICS.ACCOUNT_CREATED;
  constructor(
    readonly aggregateId: string,
    readonly payload: AccountCreatedPayload
  ) {}
}
