import { Prisma } from '@prisma/client';
import { DepositHandler } from './deposit.handler';

describe('DepositHandler', () => {
  const handler = new DepositHandler();
  const payload = {
    id: 'tx-1',
    type: 'DEPOSIT' as const,
    amount: '10',
    targetAccountId: 'a-1',
    requestedAt: '2026-01-01T00:00:00Z'
  };

  it('increments the target balance and returns an accepted outcome', async () => {
    const target = { id: 'a-1', balance: new Prisma.Decimal('5') };
    const updated = { id: 'a-1', balance: new Prisma.Decimal('15') };
    const tx: any = {
      account: {
        findUnique: jest.fn().mockResolvedValue(target),
        update: jest.fn().mockResolvedValue(updated)
      }
    };

    const result = await handler.apply({
      tx,
      payload,
      amount: new Prisma.Decimal('10')
    });

    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 'a-1' },
      data: { balance: { increment: new Prisma.Decimal('10') } }
    });
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        movements: [
          {
            accountId: 'a-1',
            previousBalance: '5',
            newBalance: '15',
            delta: '10'
          }
        ]
      })
    );
  });

  it('returns a rejected outcome when target account is missing', async () => {
    const tx: any = {
      account: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() }
    };

    const result = await handler.apply({
      tx,
      payload,
      amount: new Prisma.Decimal('10')
    });

    expect(tx.account.update).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ success: false, reason: 'Target account not found' })
    );
  });
});
