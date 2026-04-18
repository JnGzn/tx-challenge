import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { ACCOUNT_REPOSITORY } from './domain/account.repository';
import { CLIENT_REPOSITORY } from '../clients/domain/client.repository';
import { KafkaProducer } from '../common/kafka/kafka.producer';
import { TOPICS } from '../common/kafka/topics';

describe('AccountsService', () => {
  let service: AccountsService;
  let accounts: {
    create: jest.Mock;
    findById: jest.Mock;
    findManyByClientId: jest.Mock;
  };
  let clients: { create: jest.Mock; findById: jest.Mock; findByEmail: jest.Mock };
  let producer: { emit: jest.Mock };

  const buildAccount = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'a-1',
    clientId: 'c-1',
    number: 'ACC-0000000001',
    balance: new Prisma.Decimal('0'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides
  });

  beforeEach(async () => {
    accounts = {
      create: jest.fn(),
      findById: jest.fn(),
      findManyByClientId: jest.fn()
    };
    clients = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn()
    };
    producer = { emit: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: ACCOUNT_REPOSITORY, useValue: accounts },
        { provide: CLIENT_REPOSITORY, useValue: clients },
        { provide: KafkaProducer, useValue: producer }
      ]
    }).compile();

    service = module.get(AccountsService);
  });

  describe('create', () => {
    it('throws NotFoundException when client does not exist', async () => {
      clients.findById.mockResolvedValue(null);

      await expect(
        service.create({ clientId: '00000000-0000-0000-0000-000000000001' })
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(accounts.create).not.toHaveBeenCalled();
      expect(producer.emit).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when initialBalance is negative', async () => {
      clients.findById.mockResolvedValue({ id: 'c-1' });

      await expect(
        service.create({ clientId: 'c-1', initialBalance: -1 })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(accounts.create).not.toHaveBeenCalled();
    });

    it('creates the account and emits account.created', async () => {
      clients.findById.mockResolvedValue({ id: 'c-1' });
      accounts.create.mockResolvedValue(buildAccount());

      const result = await service.create({ clientId: 'c-1', initialBalance: 0 });

      expect(accounts.create).toHaveBeenCalledWith({
        clientId: 'c-1',
        number: expect.stringMatching(/^ACC-\d{10}$/),
        initialBalance: 0
      });
      expect(producer.emit).toHaveBeenCalledWith(
        TOPICS.ACCOUNT_CREATED,
        'a-1',
        expect.objectContaining({
          id: 'a-1',
          clientId: 'c-1',
          number: 'ACC-0000000001',
          balance: '0',
          createdAt: '2026-01-01T00:00:00.000Z'
        })
      );
      expect(result.id).toBe('a-1');
    });

    it('respects a caller-provided account number', async () => {
      clients.findById.mockResolvedValue({ id: 'c-1' });
      accounts.create.mockResolvedValue(buildAccount({ number: 'ACC-CUSTOM-1' }));

      await service.create({ clientId: 'c-1', number: 'ACC-CUSTOM-1' });

      expect(accounts.create).toHaveBeenCalledWith(
        expect.objectContaining({ number: 'ACC-CUSTOM-1', initialBalance: 0 })
      );
    });
  });

  describe('findOne', () => {
    it('returns the account when found', async () => {
      const account = buildAccount();
      accounts.findById.mockResolvedValue(account);

      await expect(service.findOne('a-1')).resolves.toBe(account);
    });

    it('throws NotFoundException when missing', async () => {
      accounts.findById.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getBalance', () => {
    it('returns id and balance as string', async () => {
      accounts.findById.mockResolvedValue(
        buildAccount({ balance: new Prisma.Decimal('125.50') })
      );

      await expect(service.getBalance('a-1')).resolves.toEqual({
        id: 'a-1',
        balance: '125.5'
      });
    });

    it('propagates NotFoundException from findOne', async () => {
      accounts.findById.mockResolvedValue(null);

      await expect(service.getBalance('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
