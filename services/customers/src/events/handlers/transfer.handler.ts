import { Injectable } from '@nestjs/common';
import { accepted, ITransactionHandler, rejected } from './transaction-handler';
import { HandlerContext, TransactionOutcome } from './transaction.types';

@Injectable()
export class TransferHandler implements ITransactionHandler {
  readonly type = 'TRANSFER' as const;

  async apply({ tx, payload, amount }: HandlerContext): Promise<TransactionOutcome> {
    const [source, target] = await Promise.all([
      tx.account.findUnique({ where: { id: payload.sourceAccountId! } }),
      tx.account.findUnique({ where: { id: payload.targetAccountId! } })
    ]);
    if (!source) return rejected(payload, 'Source account not found');
    if (!target) return rejected(payload, 'Target account not found');
    if (source.balance.lessThan(amount)) return rejected(payload, 'Insufficient funds');

    const debited = await tx.account.update({
      where: { id: source.id },
      data: { balance: { decrement: amount } }
    });
    const credited = await tx.account.update({
      where: { id: target.id },
      data: { balance: { increment: amount } }
    });

    return accepted(payload, [
      {
        accountId: debited.id,
        previousBalance: source.balance.toString(),
        newBalance: debited.balance.toString(),
        delta: amount.negated().toString()
      },
      {
        accountId: credited.id,
        previousBalance: target.balance.toString(),
        newBalance: credited.balance.toString(),
        delta: amount.toString()
      }
    ]);
  }
}
