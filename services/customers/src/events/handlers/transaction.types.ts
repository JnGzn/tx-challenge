import { Prisma } from '@prisma/client';

export type TransactionKind = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';

const ALLOWED_TRANSACTION_KINDS: ReadonlySet<string> = new Set<TransactionKind>(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']);

export function assertTransactionKind(value: unknown): asserts value is TransactionKind {
  if (typeof value !== 'string' || !ALLOWED_TRANSACTION_KINDS.has(value)) {
    throw new Error(`Invalid transaction type: ${String(value)}`);
  }
}

export interface TransactionRequestedPayload {
  id: string;
  type: TransactionKind;
  amount: string;
  sourceAccountId?: string;
  targetAccountId?: string;
  requestedAt: string;
}

export interface BalanceMovement {
  accountId: string;
  previousBalance: string;
  newBalance: string;
  delta: string;
}

export type TransactionOutcome =
  | {
      transactionId: string;
      type: TransactionKind;
      success: true;
      movements: BalanceMovement[];
      updatedAt: string;
    }
  | {
      transactionId: string;
      type: TransactionKind;
      success: false;
      reason: string;
      updatedAt: string;
    };

export interface HandlerContext {
  tx: Prisma.TransactionClient;
  payload: TransactionRequestedPayload;
  amount: Prisma.Decimal;
}
