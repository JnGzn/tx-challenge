import { Injectable } from '@nestjs/common';
import { accepted, ITransactionHandler, rejected } from './transaction-handler';
import { HandlerContext, TransactionOutcome } from './transaction.types';

@Injectable()
export class WithdrawalHandler implements ITransactionHandler {
  readonly type = 'WITHDRAWAL' as const;

  async apply({ tx, payload, amount }: HandlerContext): Promise<TransactionOutcome> {
    const source = await tx.account.findUnique({ where: { id: payload.sourceAccountId! } });
    if (!source) return rejected(payload, 'Source account not found');
    if (source.balance.lessThan(amount)) return rejected(payload, 'Insufficient funds');

    const updated = await tx.account.update({
      where: { id: source.id },
      data: { balance: { decrement: amount } }
    });

    return accepted(payload, [
      {
        accountId: updated.id,
        previousBalance: source.balance.toString(),
        newBalance: updated.balance.toString(),
        delta: amount.negated().toString()
      }
    ]);
  }
}
