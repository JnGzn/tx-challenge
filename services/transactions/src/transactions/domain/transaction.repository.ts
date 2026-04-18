import { Prisma, Transaction, TransactionStatus, TransactionType } from '@prisma/client';

export const TRANSACTION_REPOSITORY = Symbol('ITransactionRepository');

export interface CreateTransactionData {
  id?: string;
  type: TransactionType;
  amount: Prisma.Decimal;
  sourceAccountId?: string;
  targetAccountId?: string;
  status: TransactionStatus;
}

export interface TransactionFilter {
  status?: TransactionStatus;
  type?: TransactionType;
  accountId?: string;
}

export interface ITransactionRepository {
  create(data: CreateTransactionData): Promise<Transaction>;
  findById(id: string): Promise<Transaction | null>;
  findMany(filter: TransactionFilter, limit: number): Promise<Transaction[]>;
}
