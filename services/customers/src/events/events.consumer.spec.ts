import { Prisma } from '@prisma/client';
import { asUnrecoverable, isUnrecoverable } from '../common/kafka/dlq.service';
import { EventsConsumer } from './events.consumer';
import { TOPICS } from '../common/kafka/topics';

describe('EventsConsumer', () => {
  let consumer: EventsConsumer;
  let producer: { emit: jest.Mock };
  let idempotency: { execute: jest.Mock };
  let dlq: { process: jest.Mock };
  let handlers: { resolve: jest.Mock };
  let caught: unknown;

  const ctx = { getTopic: () => TOPICS.TRANSACTION_REQUESTED } as any;

  const captureCb = (cb: () => Promise<unknown>) => cb().catch((e) => (caught = e));

  beforeEach(() => {
    caught = undefined;
    producer = { emit: jest.fn().mockResolvedValue(undefined) };
    idempotency = { execute: jest.fn() };
    dlq = {
      process: jest.fn().mockImplementation(async (_t, _k, _p, cb) => captureCb(cb))
    };
    handlers = { resolve: jest.fn() };
    consumer = new EventsConsumer(
      producer as any,
      idempotency as any,
      dlq as any,
      handlers as any
    );
  });

  const validPayload = {
    id: 'tx-1',
    type: 'DEPOSIT' as const,
    amount: '10',
    targetAccountId: 'a-1',
    requestedAt: '2026-01-01T00:00:00Z'
  };

  it('resolves handler and emits balance.updated on success', async () => {
    const handler = { apply: jest.fn().mockResolvedValue({ ok: true }) };
    handlers.resolve.mockReturnValue(handler);
    idempotency.execute.mockImplementation(async (_id, _t, cb) => cb({} as any));

    await consumer.onTransactionRequested(validPayload, ctx);

    expect(handlers.resolve).toHaveBeenCalledWith('DEPOSIT');
    expect(handler.apply).toHaveBeenCalledWith(
      expect.objectContaining({ amount: expect.any(Prisma.Decimal) })
    );
    expect(producer.emit).toHaveBeenCalledWith(
      TOPICS.BALANCE_UPDATED,
      'tx-1',
      { ok: true }
    );
  });

  it('does not emit balance.updated when idempotency returns null', async () => {
    idempotency.execute.mockResolvedValue(null);

    await consumer.onTransactionRequested(validPayload, ctx);

    expect(producer.emit).not.toHaveBeenCalled();
  });

  it('throws unrecoverable on invalid payload', async () => {
    await consumer.onTransactionRequested({ ...validPayload, amount: '-1' }, ctx);
    expect(isUnrecoverable(caught)).toBe(true);
  });

  it('throws on invalid transaction kind', async () => {
    await consumer.onTransactionRequested(
      { ...validPayload, type: 'BOGUS' as any },
      ctx
    );
    expect(caught).toBeInstanceOf(Error);
  });

  it('uses "unknown" key when payload has no id', async () => {
    await consumer.onTransactionRequested({} as any, ctx);
    expect(dlq.process).toHaveBeenCalledWith(
      TOPICS.TRANSACTION_REQUESTED,
      'unknown',
      expect.anything(),
      expect.any(Function)
    );
  });

  it('asUnrecoverable round-trip sanity', () => {
    const tagged = asUnrecoverable(new Error('x'));
    expect(isUnrecoverable(tagged)).toBe(true);
  });
});
