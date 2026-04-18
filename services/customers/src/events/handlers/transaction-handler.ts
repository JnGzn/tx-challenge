import {
  BalanceMovement,
  HandlerContext,
  TransactionKind,
  TransactionOutcome,
  TransactionRequestedPayload
} from './transaction.types';

export const TRANSACTION_HANDLER = Symbol('ITransactionHandler');

export interface ITransactionHandler {
  readonly type: TransactionKind;
  apply(ctx: HandlerContext): Promise<TransactionOutcome>;
}

export function accepted(
  payload: TransactionRequestedPayload,
  movements: BalanceMovement[]
): TransactionOutcome {
  return {
    transactionId: payload.id,
    type: payload.type,
    success: true,
    movements,
    updatedAt: new Date().toISOString()
  };
}

export function rejected(
  payload: TransactionRequestedPayload,
  reason: string
): TransactionOutcome {
  return {
    transactionId: payload.id,
    type: payload.type,
    success: false,
    reason,
    updatedAt: new Date().toISOString()
  };
}
