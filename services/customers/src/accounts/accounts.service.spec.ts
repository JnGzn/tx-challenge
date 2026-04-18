import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountsService } from './accounts.service';
import { ACCOUNT_REPOSITORY } from './domain/account.repository';
import { CLIENT_REPOSITORY } from '../clients/domain/client.repository';
import { DOMAIN_EVENT_PUBLISHER } from '../common/events/domain-event-publisher';
import { TOPICS } from '../common/kafka/topics';

describe('AccountsService', () => {
  let service: AccountsService;
  let accounts: { create: jest.Mock; findById: jest.Mock; findManyByClientId: jest.Mock };
  let clients: { create: jest.Mock; findById: jest.Mock; findByEmail: jest.Mock };
  let events: { publish: jest.Mock };

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
    events = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: ACCOUNT_REPOSITORY, useValue: accounts },
        { provide: CLIENT_REPOSITORY, useValue: clients },
        { provide: DOMAIN_EVENT_PUBLISHER, useValue: events }
      ]
    }).compile();

    service = module.get(AccountsService);
  });

  it('throws when the client does not exist', async () => {
    clients.findById.mockResolvedValue(null);
    await expect(
      service.create({ clientId: '00000000-0000-0000-0000-000000000001' })
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('creates the account and publishes AccountCreated', async () => {
    clients.findById.mockResolvedValue({ id: 'c-1' });
    accounts.create.mockResolvedValue({
      id: 'a-1',
      clientId: 'c-1',
      number: 'ACC-0000000001',
      balance: new Prisma.Decimal('0'),
      createdAt: new Date('2026-01-01T00:00:00Z')
    });

    await service.create({ clientId: 'c-1', initialBalance: 0 });

    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: TOPICS.ACCOUNT_CREATED,
        aggregateId: 'a-1',
        payload: expect.objectContaining({ id: 'a-1', clientId: 'c-1' })
      })
    );
  });
});
