import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CLIENT_REPOSITORY } from './domain/client.repository';
import { ACCOUNT_REPOSITORY } from '../accounts/domain/account.repository';
import { KafkaProducer } from '../common/kafka/kafka.producer';
import { TOPICS } from '../common/kafka/topics';

describe('ClientsService', () => {
  let service: ClientsService;
  let clients: { create: jest.Mock; findById: jest.Mock; findByEmail: jest.Mock };
  let accounts: {
    create: jest.Mock;
    findById: jest.Mock;
    findManyByClientId: jest.Mock;
  };
  let producer: { emit: jest.Mock };

  const buildClient = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'c-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides
  });

  beforeEach(async () => {
    clients = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn()
    };
    accounts = {
      create: jest.fn(),
      findById: jest.fn(),
      findManyByClientId: jest.fn()
    };
    producer = { emit: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: CLIENT_REPOSITORY, useValue: clients },
        { provide: ACCOUNT_REPOSITORY, useValue: accounts },
        { provide: KafkaProducer, useValue: producer }
      ]
    }).compile();

    service = module.get(ClientsService);
  });

  describe('create', () => {
    it('persists the client and emits client.created', async () => {
      const created = buildClient();
      clients.create.mockResolvedValue(created);

      const result = await service.create({
        name: 'Ada Lovelace',
        email: 'ada@example.com'
      });

      expect(clients.create).toHaveBeenCalledWith({
        name: 'Ada Lovelace',
        email: 'ada@example.com'
      });
      expect(producer.emit).toHaveBeenCalledWith(TOPICS.CLIENT_CREATED, 'c-1', {
        id: 'c-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        createdAt: '2026-01-01T00:00:00.000Z'
      });
      expect(result).toBe(created);
    });

    it('propagates repository errors without emitting', async () => {
      const boom = new Error('db down');
      clients.create.mockRejectedValue(boom);

      await expect(
        service.create({ name: 'Ada', email: 'ada@example.com' })
      ).rejects.toBe(boom);
      expect(producer.emit).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('returns the client when found', async () => {
      const client = buildClient();
      clients.findByEmail.mockResolvedValue(client);

      await expect(service.findByEmail('ada@example.com')).resolves.toBe(client);
      expect(clients.findByEmail).toHaveBeenCalledWith('ada@example.com');
    });

    it('throws NotFoundException when missing', async () => {
      clients.findByEmail.mockResolvedValue(null);

      await expect(service.findByEmail('nobody@example.com')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('listAccountsByEmail', () => {
    it('returns accounts for the client resolved by email', async () => {
      const client = buildClient();
      const accountList = [
        {
          id: 'a-1',
          clientId: 'c-1',
          number: 'ACC-0000000001',
          balance: new Prisma.Decimal('0'),
          createdAt: new Date()
        }
      ];
      clients.findByEmail.mockResolvedValue(client);
      accounts.findManyByClientId.mockResolvedValue(accountList);

      await expect(service.listAccountsByEmail('ada@example.com')).resolves.toBe(
        accountList
      );
      expect(accounts.findManyByClientId).toHaveBeenCalledWith('c-1');
    });

    it('throws NotFoundException when the email has no client', async () => {
      clients.findByEmail.mockResolvedValue(null);

      await expect(
        service.listAccountsByEmail('ghost@example.com')
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(accounts.findManyByClientId).not.toHaveBeenCalled();
    });
  });
});
