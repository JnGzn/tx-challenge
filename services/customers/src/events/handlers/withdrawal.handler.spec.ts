import { Prisma } from '@prisma/client';
import { WithdrawalHandler } from './withdrawal.handler';

describe('WithdrawalHandler', () => {
  const handler = new WithdrawalHandler();
  const payload = {
    id: 'tx-1',
    type: 'WITHDRAWAL' as const,
    amount: '10',
    sourceAccountId: 'a-1',
    requestedAt: '2026-01-01T00:00:00Z'
  };

  it('rejects when the source account is missing', async () => {
    const tx: any = {
      account: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() }
    };

    const result = await handler.apply({
      tx,
      payload,
      amount: new Prisma.Decimal('10')
    });
    expect(result).toEqual(
      expect.objectContaining({ success: false, reason: 'Source account not found' })
    );
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('rejects on insufficient funds', async () => {
    const source = { id: 'a-1', balance: new Prisma.Decimal('5') };
    const tx: any = {
      account: { findUnique: jest.fn().mockResolvedValue(source), update: jest.fn() }
    };

    const result = await handler.apply({
      tx,
      payload,
      amount: new Prisma.Decimal('10')
    });
    expect(result).toEqual(
      expect.objectContaining({ success: false, reason: 'Insufficient funds' })
    );
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('debits and returns accepted outcome', async () => {
    const source = { id: 'a-1', balance: new Prisma.Decimal('50') };
    const updated = { id: 'a-1', balance: new Prisma.Decimal('40') };
    const tx: any = {
      account: {
        findUnique: jest.fn().mockResolvedValue(source),
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
      data: { balance: { decrement: new Prisma.Decimal('10') } }
    });
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        movements: [
          {
            accountId: 'a-1',
            previousBalance: '50',
            newBalance: '40',
            delta: '-10'
          }
        ]
      })
    );
  });
});
