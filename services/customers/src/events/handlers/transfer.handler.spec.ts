import { Prisma } from '@prisma/client';
import { TransferHandler } from './transfer.handler';

describe('TransferHandler', () => {
  const handler = new TransferHandler();
  const payload = {
    id: 'tx-1',
    type: 'TRANSFER' as const,
    amount: '10',
    sourceAccountId: 'a-1',
    targetAccountId: 'a-2',
    requestedAt: '2026-01-01T00:00:00Z'
  };

  const amount = new Prisma.Decimal('10');

  const makeTx = (source: any, target: any, updates: any[] = []) => {
    const calls = [...updates];
    return {
      account: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            where.id === 'a-1' ? source : target
          ),
        update: jest.fn().mockImplementation(async () => calls.shift())
      }
    };
  };

  it('rejects when source is missing', async () => {
    const tx: any = makeTx(null, { id: 'a-2', balance: new Prisma.Decimal('0') });
    const result = await handler.apply({ tx, payload, amount });
    expect(result).toEqual(
      expect.objectContaining({ success: false, reason: 'Source account not found' })
    );
  });

  it('rejects when target is missing', async () => {
    const tx: any = makeTx({ id: 'a-1', balance: new Prisma.Decimal('100') }, null);
    const result = await handler.apply({ tx, payload, amount });
    expect(result).toEqual(
      expect.objectContaining({ success: false, reason: 'Target account not found' })
    );
  });

  it('rejects on insufficient funds', async () => {
    const tx: any = makeTx(
      { id: 'a-1', balance: new Prisma.Decimal('5') },
      { id: 'a-2', balance: new Prisma.Decimal('0') }
    );
    const result = await handler.apply({ tx, payload, amount });
    expect(result).toEqual(
      expect.objectContaining({ success: false, reason: 'Insufficient funds' })
    );
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('moves funds and returns two movements on success', async () => {
    const tx: any = makeTx(
      { id: 'a-1', balance: new Prisma.Decimal('100') },
      { id: 'a-2', balance: new Prisma.Decimal('20') },
      [
        { id: 'a-1', balance: new Prisma.Decimal('90') },
        { id: 'a-2', balance: new Prisma.Decimal('30') }
      ]
    );

    const result = await handler.apply({ tx, payload, amount });

    expect(tx.account.update).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        movements: [
          {
            accountId: 'a-1',
            previousBalance: '100',
            newBalance: '90',
            delta: '-10'
          },
          {
            accountId: 'a-2',
            previousBalance: '20',
            newBalance: '30',
            delta: '10'
          }
        ]
      })
    );
  });
});
