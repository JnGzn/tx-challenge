export const DOMAIN_EVENT_PUBLISHER = Symbol('IDomainEventPublisher');

export interface DomainEvent<TPayload = unknown> {
  readonly name: string;
  readonly aggregateId: string;
  readonly payload: TPayload;
}

export interface IDomainEventPublisher {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
}
