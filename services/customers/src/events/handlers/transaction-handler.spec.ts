import { accepted, rejected } from './transaction-handler';
import { TransactionRequestedPayload } from './transaction.types';

describe('transaction-handler helpers', () => {
  const payload: TransactionRequestedPayload = {
    id: 'tx-1',
    type: 'DEPOSIT',
    amount: '10',
    targetAccountId: 'a-1',
    requestedAt: '2026-01-01T00:00:00Z'
  };

  it('accepted builds a success outcome with movements', () => {
    const result = accepted(payload, [
      { accountId: 'a-1', previousBalance: '0', newBalance: '10', delta: '10' }
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        transactionId: 'tx-1',
        type: 'DEPOSIT',
        success: true,
        movements: [
          { accountId: 'a-1', previousBalance: '0', newBalance: '10', delta: '10' }
        ],
        updatedAt: expect.any(String)
      })
    );
  });

  it('rejected builds a failure outcome with reason', () => {
    const result = rejected(payload, 'nope');
    expect(result).toEqual(
      expect.objectContaining({
        transactionId: 'tx-1',
        type: 'DEPOSIT',
        success: false,
        reason: 'nope',
        updatedAt: expect.any(String)
      })
    );
  });
});
