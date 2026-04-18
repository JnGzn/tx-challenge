import { isUnrecoverable } from '../common/kafka/dlq.service';
import { EventsConsumer } from './events.consumer';
import { TOPICS } from '../common/kafka/topics';

describe('EventsConsumer', () => {
  let consumer: EventsConsumer;
  let transactionsService: {
    applyBalanceUpdate: jest.Mock;
    publishOutcome: jest.Mock;
  };
  let idempotency: { execute: jest.Mock };
  let dlq: { process: jest.Mock };
  let caught: unknown;

  const ctx = { getTopic: () => TOPICS.BALANCE_UPDATED } as any;

  beforeEach(() => {
    caught = undefined;
    transactionsService = {
      applyBalanceUpdate: jest.fn(),
      publishOutcome: jest.fn().mockResolvedValue(undefined)
    };
    idempotency = { execute: jest.fn() };
    dlq = {
      process: jest
        .fn()
        .mockImplementation(async (_t, _k, _p, cb) =>
          cb().catch((e: unknown) => (caught = e))
        )
    };
    consumer = new EventsConsumer(
      transactionsService as any,
      idempotency as any,
      dlq as any
    );
  });

  const payload = {
    transactionId: 't-1',
    type: 'DEPOSIT' as const,
    success: true,
    movements: [],
    updatedAt: '2026-01-02T00:00:00Z'
  };

  it('publishes the outcome when idempotency executes successfully', async () => {
    const outcome = { kind: 'completed' };
    idempotency.execute.mockImplementation(async (_id, _t, cb) => {
      await cb({});
      return outcome;
    });
    transactionsService.applyBalanceUpdate.mockResolvedValue(outcome);

    await consumer.onBalanceUpdated(payload, ctx);

    expect(idempotency.execute).toHaveBeenCalledWith(
      `${payload.transactionId}:${payload.updatedAt}`,
      TOPICS.BALANCE_UPDATED,
      expect.any(Function)
    );
    expect(transactionsService.publishOutcome).toHaveBeenCalledWith(outcome);
  });

  it('does not publish when idempotency returns null (duplicate)', async () => {
    idempotency.execute.mockResolvedValue(null);

    await consumer.onBalanceUpdated(payload, ctx);

    expect(transactionsService.publishOutcome).not.toHaveBeenCalled();
  });

  it('throws unrecoverable on malformed payload', async () => {
    await consumer.onBalanceUpdated({} as any, ctx);
    expect(isUnrecoverable(caught)).toBe(true);
  });

  it('uses "unknown" key when transactionId missing', async () => {
    await consumer.onBalanceUpdated({} as any, ctx);
    expect(dlq.process).toHaveBeenCalledWith(
      TOPICS.BALANCE_UPDATED,
      'unknown',
      expect.anything(),
      expect.any(Function)
    );
  });
});
