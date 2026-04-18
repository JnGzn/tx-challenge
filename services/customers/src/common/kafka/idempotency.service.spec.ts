import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: { $transaction: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    prisma = { $transaction: jest.fn() };
    service = new IdempotencyService(prisma as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('executes handler inside transaction after registering the event', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    const tx = { processedEvent: { create: jest.fn().mockResolvedValue(undefined) } };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.execute('evt-1', 'topic', handler);

    expect(result).toBe('result');
    expect(tx.processedEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt-1', topic: 'topic' }
    });
    expect(handler).toHaveBeenCalledWith(tx);
  });

  it('returns null when event already processed (P2002)', async () => {
    const uniqueViolation = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'x'
    } as any);
    prisma.$transaction.mockRejectedValue(uniqueViolation);

    const result = await service.execute('evt-1', 'topic', jest.fn());
    expect(result).toBeNull();
  });

  it('rethrows other errors', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db exploded'));
    await expect(service.execute('evt-1', 'topic', jest.fn())).rejects.toThrow(
      'db exploded'
    );
  });

  it('rethrows non-P2002 Prisma known errors', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P2025',
      clientVersion: 'x'
    } as any);
    prisma.$transaction.mockRejectedValue(err);
    await expect(service.execute('e', 't', jest.fn())).rejects.toBe(err);
  });
});
