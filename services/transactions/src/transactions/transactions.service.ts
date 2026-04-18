import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Transaction, TransactionStatus } from '@prisma/client';
import { KafkaProducer } from '../common/kafka/kafka.producer';
import { TOPICS } from '../common/kafka/topics';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY
} from './domain/transaction.repository';
import { validateTransactionRules } from './domain/transaction-validator';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { asUnrecoverable } from '../common/kafka/dlq.service';

const DEFAULT_LIST_LIMIT = 100;

export type BalanceUpdatedEvent = {
  transactionId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  success: boolean;
  movements?: Array<{
    accountId: string;
    previousBalance: string;
    newBalance: string;
    delta: string;
  }>;
  reason?: string;
  updatedAt: string;
};

export type TransactionOutcome =
  | { kind: 'completed'; transactionId: string; type: string; amount: string; sourceAccountId?: string; targetAccountId?: string; movements: NonNullable<BalanceUpdatedEvent['movements']>; completedAt: string }
  | { kind: 'rejected'; transactionId: string; type: string; amount: string; sourceAccountId?: string; targetAccountId?: string; reason: string; rejectedAt: string };

@Injectable()
export class TransactionsService {
  private readonly listLimit: number;

  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactions: ITransactionRepository,
    private readonly producer: KafkaProducer,
    config: ConfigService
  ) {
    this.listLimit = config.get<number>('TRANSACTIONS_LIST_LIMIT') ?? DEFAULT_LIST_LIMIT;
  }

  async request(dto: CreateTransactionDto): Promise<Transaction> {
    validateTransactionRules(dto);

    const transaction = await this.transactions.create({
      id: dto.idempotencyKey,
      type: dto.type,
      amount: new Prisma.Decimal(dto.amount),
      status: TransactionStatus.PENDING,
      sourceAccountId: dto.sourceAccountId,
      targetAccountId: dto.targetAccountId
    });

    await this.producer.emit(TOPICS.TRANSACTION_REQUESTED, transaction.id, {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount.toString(),
      sourceAccountId: transaction.sourceAccountId ?? undefined,
      targetAccountId: transaction.targetAccountId ?? undefined,
      requestedAt: transaction.requestedAt.toISOString()
    });

    return transaction;
  }

  async applyBalanceUpdate(
    payload: BalanceUpdatedEvent,
    tx: Prisma.TransactionClient
  ): Promise<TransactionOutcome | null> {
    const current = await tx.transaction.findUnique({ where: { id: payload.transactionId } });
    if (!current) {
      throw asUnrecoverable(new Error(`Transaction ${payload.transactionId} not found`));
    }
    if (current.status !== TransactionStatus.PENDING) return null;

    if (payload.success) {
      const updated = await tx.transaction.update({
        where: { id: payload.transactionId },
        data: { status: TransactionStatus.COMPLETED, completedAt: new Date() }
      });
      return {
        kind: 'completed',
        transactionId: updated.id,
        type: updated.type,
        amount: updated.amount.toString(),
        sourceAccountId: updated.sourceAccountId ?? undefined,
        targetAccountId: updated.targetAccountId ?? undefined,
        movements: payload.movements ?? [],
        completedAt: (updated.completedAt ?? new Date()).toISOString()
      };
    }

    const updated = await tx.transaction.update({
      where: { id: payload.transactionId },
      data: { status: TransactionStatus.REJECTED, reason: payload.reason ?? 'Unknown reason', rejectedAt: new Date() }
    });
    return {
      kind: 'rejected',
      transactionId: updated.id,
      type: updated.type,
      amount: updated.amount.toString(),
      sourceAccountId: updated.sourceAccountId ?? undefined,
      targetAccountId: updated.targetAccountId ?? undefined,
      reason: updated.reason ?? 'Unknown reason',
      rejectedAt: (updated.rejectedAt ?? new Date()).toISOString()
    };
  }

  async publishOutcome(outcome: TransactionOutcome): Promise<void> {
    const topic = outcome.kind === 'completed' ? TOPICS.TRANSACTION_COMPLETED : TOPICS.TRANSACTION_REJECTED;
    const { kind: _kind, ...body } = outcome;
    await this.producer.emit(topic, outcome.transactionId, body);
  }

  async findOne(id: string): Promise<Transaction> {
    const tx = await this.transactions.findById(id);
    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }

  list(query: QueryTransactionsDto): Promise<Transaction[]> {
    return this.transactions.findMany(query, this.listLimit);
  }
}
