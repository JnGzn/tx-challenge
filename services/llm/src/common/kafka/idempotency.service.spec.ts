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

  it('runs handler inside transaction after recording the event', async () => {
    const handler = jest.fn().mockResolvedValue('ok');
    const tx = { processedEvent: { create: jest.fn().mockResolvedValue(undefined) } };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(service.execute('evt-1', 'topic', handler)).resolves.toBe('ok');
    expect(tx.processedEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt-1', topic: 'topic' }
    });
  });

  it('returns null on unique violation P2002', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'x'
      } as any)
    );
    await expect(service.execute('e', 't', jest.fn())).resolves.toBeNull();
  });

  it('rethrows other errors', async () => {
    prisma.$transaction.mockRejectedValue(new Error('boom'));
    await expect(service.execute('e', 't', jest.fn())).rejects.toThrow('boom');
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
