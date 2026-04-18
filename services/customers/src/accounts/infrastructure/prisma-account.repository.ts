import { Injectable } from '@nestjs/common';
import { Account, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAccountData, IAccountRepository } from '../domain/account.repository';

@Injectable()
export class PrismaAccountRepository implements IAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateAccountData): Promise<Account> {
    return this.prisma.account.create({
      data: {
        clientId: data.clientId,
        number: data.number,
        balance: new Prisma.Decimal(data.initialBalance)
      }
    });
  }

  findById(id: string): Promise<Account | null> {
    return this.prisma.account.findUnique({ where: { id } });
  }

  findManyByClientId(clientId: string): Promise<Account[]> {
    return this.prisma.account.findMany({ where: { clientId } });
  }
}
