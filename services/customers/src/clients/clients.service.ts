import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Account, Client } from '@prisma/client';
import { KafkaProducer } from '../common/kafka/kafka.producer';
import { TOPICS } from '../common/kafka/topics';
import { ClientCreatedEvent } from './domain/events/client-created.event';
import { CLIENT_REPOSITORY, IClientRepository } from './domain/client.repository';
import {
  ACCOUNT_REPOSITORY,
  IAccountRepository
} from '../accounts/domain/account.repository';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @Inject(CLIENT_REPOSITORY) private readonly clients: IClientRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: IAccountRepository,
    private readonly producer: KafkaProducer
  ) {}

  async create(dto: CreateClientDto): Promise<Client> {
    const client = await this.clients.create(dto);
    await this.producer.emit(TOPICS.CLIENT_CREATED, client.id, {
      id: client.id,
      name: client.name,
      email: client.email,
      createdAt: client.createdAt.toISOString()
    });
    return client;
  }

  async findByEmail(email: string): Promise<Client> {
    const client = await this.clients.findByEmail(email);
    if (!client) throw new NotFoundException(`Client with email ${email} not found`);
    return client;
  }

  async listAccountsByEmail(email: string): Promise<Account[]> {
    const client = await this.findByEmail(email);
    return this.accounts.findManyByClientId(client.id);
  }
}
