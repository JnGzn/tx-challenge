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

  it('emits using key/value envelope', async () => {
    await producer.emit('topic', 'k', { a: 1 });
    expect(client.emit).toHaveBeenCalledWith('topic', { key: 'k', value: { a: 1 } });
  });
});
