import { Injectable } from '@nestjs/common';
import { Prisma, Transaction } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateTransactionData,
  ITransactionRepository,
  TransactionFilter
} from '../domain/transaction.repository';

@Injectable()
export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateTransactionData): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  findMany(filter: TransactionFilter, limit: number): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;
    if (filter.accountId) {
      where.OR = [
        { sourceAccountId: filter.accountId },
        { targetAccountId: filter.accountId }
      ];
    }
    return this.prisma.transaction.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      take: limit
    });
  }
}
