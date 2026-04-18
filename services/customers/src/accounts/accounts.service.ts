import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Account } from '@prisma/client';
import { randomInt } from 'crypto';
import { KafkaProducer } from '../common/kafka/kafka.producer';
import {
  CLIENT_REPOSITORY,
  IClientRepository
} from '../clients/domain/client.repository';
import { ACCOUNT_REPOSITORY, IAccountRepository } from './domain/account.repository';
import { AccountCreatedEvent } from './domain/events/account-created.event';
import { CreateAccountDto } from './dto/create-account.dto';
import { TOPICS } from '../common/kafka/topics';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: IAccountRepository,
    @Inject(CLIENT_REPOSITORY) private readonly clients: IClientRepository,
    private readonly producer: KafkaProducer
  ) {}

  async create(dto: CreateAccountDto): Promise<Account> {
    const client = await this.clients.findById(dto.clientId);
    if (!client) throw new NotFoundException(`Client ${dto.clientId} not found`);

    const initialBalance = dto.initialBalance ?? 0;
    if (initialBalance < 0) throw new BadRequestException('initialBalance cannot be negative');

    const account = await this.accounts.create({
      clientId: dto.clientId,
      number: dto.number ?? AccountsService.generateAccountNumber(),
      initialBalance
    });

    await this.producer.emit(TOPICS.ACCOUNT_CREATED, account.id, {
      id: account.id,
      clientId: account.clientId,
      number: account.number,
      balance: account.balance.toString(),
      createdAt: account.createdAt.toISOString()
    });

    return account;
  }

  async findOne(id: string): Promise<Account> {
    const account = await this.accounts.findById(id);
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  async getBalance(id: string): Promise<{ id: string; balance: string }> {
    const account = await this.findOne(id);
    return { id: account.id, balance: account.balance.toString() };
  }

  private static generateAccountNumber(): string {
    const body = Array.from({ length: 10 }, () => randomInt(0, 10)).join('');
    return `ACC-${body}`;
  }
}
