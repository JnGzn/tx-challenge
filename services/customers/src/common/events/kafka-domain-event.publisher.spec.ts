import { KafkaDomainEventPublisher } from './kafka-domain-event.publisher';

describe('KafkaDomainEventPublisher', () => {
  it('forwards DomainEvent fields to KafkaProducer.emit', async () => {
    const producer = { emit: jest.fn().mockResolvedValue(undefined) };
    const publisher = new KafkaDomainEventPublisher(producer as any);

    await publisher.publish({
      name: 'client.created',
      aggregateId: 'c-1',
      payload: { id: 'c-1' }
    });

    expect(producer.emit).toHaveBeenCalledWith('client.created', 'c-1', { id: 'c-1' });
  });
});
