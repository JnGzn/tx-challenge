import { isUnrecoverable } from '../common/kafka/dlq.service';
import { EventsConsumer } from './events.consumer';
import { TOPICS } from '../common/kafka/topics';

describe('EventsConsumer', () => {
  let consumer: EventsConsumer;
  let explanations: { persist: jest.Mock };
  let idempotency: { execute: jest.Mock };
  let dlq: { process: jest.Mock };
  let caught: unknown;

  const buildCtx = (
    topic: string = TOPICS.TRANSACTION_COMPLETED,
    offset: string | null = '42'
  ): any => ({
    getTopic: () => topic,
    getPartition: () => 0,
    getMessage: () => (offset === null ? {} : { offset })
  });

  beforeEach(() => {
    caught = undefined;
    explanations = { persist: jest.fn().mockResolvedValue({}) };
    idempotency = {
      execute: jest.fn().mockImplementation(async (_id, _t, cb) => cb({}))
    };
    dlq = {
      process: jest
        .fn()
        .mockImplementation(async (_t, _k, _p, cb) =>
          cb().catch((e: unknown) => (caught = e))
        )
    };
    consumer = new EventsConsumer(
      explanations as any,
      idempotency as any,
      dlq as any
    );
  });

  const payload = {
    transactionId: 't-1',
    type: 'DEPOSIT',
    amount: '100',
    targetAccountId: 'a-1',
    completedAt: '2026-01-02T00:00:00Z'
  };

  it('persists the event on TRANSACTION_COMPLETED', async () => {
    await consumer.onCompleted(payload as any, buildCtx());

    expect(dlq.process).toHaveBeenCalledWith(
      TOPICS.TRANSACTION_COMPLETED,
      `${TOPICS.TRANSACTION_COMPLETED}:0:42`,
      payload,
      expect.any(Function)
    );
    expect(explanations.persist).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventId: `${TOPICS.TRANSACTION_COMPLETED}:0:42`,
        eventType: TOPICS.TRANSACTION_COMPLETED,
        transactionId: 't-1',
        accountId: 'a-1',
        payload: expect.objectContaining({
          transactionId: 't-1',
          type: 'DEPOSIT',
          amount: '100',
          completedAt: '2026-01-02T00:00:00Z'
        })
      })
    );
  });

  it('routes TRANSACTION_REJECTED through the same handler', async () => {
    await consumer.onRejected(
      { transactionId: 't-1', reason: 'nope', rejectedAt: '2026-01-02T00:00:00Z' } as any,
      buildCtx(TOPICS.TRANSACTION_REJECTED)
    );

    expect(explanations.persist).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: TOPICS.TRANSACTION_REJECTED,
        payload: expect.objectContaining({ reason: 'nope' })
      })
    );
  });

  it('prefers sourceAccountId as accountId when present', async () => {
    await consumer.onCompleted(
      { ...payload, sourceAccountId: 'src-1' } as any,
      buildCtx()
    );

    expect(explanations.persist).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: 'src-1' })
    );
  });

  it('throws unrecoverable when transactionId is missing', async () => {
    await consumer.onCompleted({} as any, buildCtx());
    expect(isUnrecoverable(caught)).toBe(true);
    expect(explanations.persist).not.toHaveBeenCalled();
  });

  it('throws unrecoverable synchronously when Kafka offset is missing', async () => {
    let thrown: unknown;
    try {
      await consumer.onCompleted(
        payload as any,
        buildCtx(TOPICS.TRANSACTION_COMPLETED, null)
      );
    } catch (e) {
      thrown = e;
    }
    expect(isUnrecoverable(thrown)).toBe(true);
    expect(dlq.process).not.toHaveBeenCalled();
  });
});
