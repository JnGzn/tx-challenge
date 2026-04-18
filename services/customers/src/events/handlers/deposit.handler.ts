import { Injectable } from '@nestjs/common';
import { accepted, ITransactionHandler, rejected } from './transaction-handler';
import { HandlerContext, TransactionOutcome } from './transaction.types';

@Injectable()
export class DepositHandler implements ITransactionHandler {
  readonly type = 'DEPOSIT' as const;

  async apply({ tx, payload, amount }: HandlerContext): Promise<TransactionOutcome> {
    const target = await tx.account.findUnique({ where: { id: payload.targetAccountId! } });
    if (!target) return rejected(payload, 'Target account not found');

    const updated = await tx.account.update({
      where: { id: target.id },
      data: { balance: { increment: amount } }
    });

    return accepted(payload, [
      {
        accountId: updated.id,
        previousBalance: target.balance.toString(),
        newBalance: updated.balance.toString(),
        delta: amount.toString()
      }
    ]);
  }
}
