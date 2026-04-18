import { of } from 'rxjs';
import { KafkaProducer } from './kafka.producer';

describe('KafkaProducer', () => {
  let producer: KafkaProducer;
  let client: { connect: jest.Mock; close: jest.Mock; emit: jest.Mock };

  beforeEach(() => {
    client = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn().mockReturnValue(of(undefined))
    };
    producer = new KafkaProducer(client as any);
  });

  it('connects on module init', async () => {
    await producer.onModuleInit();
    expect(client.connect).toHaveBeenCalled();
  });

  it('closes on module destroy', async () => {
    await producer.onModuleDestroy();
    expect(client.close).toHaveBeenCalled();
  });

  it('emits with key/value payload envelope', async () => {
    await producer.emit('some.topic', 'key-1', { x: 1 });
    expect(client.emit).toHaveBeenCalledWith('some.topic', {
      key: 'key-1',
      value: { x: 1 }
    });
  });
});
