import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { KafkaProducer } from '../common/kafka/kafka.producer';
import { TOPICS } from '../common/kafka/topics';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repo: { create: jest.Mock; findById: jest.Mock; findMany: jest.Mock };
  let producer: { emit: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn()
    };
    producer = { emit: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TRANSACTION_REPOSITORY, useValue: repo },
        { provide: KafkaProducer, useValue: producer },
        { provide: ConfigService, useValue: { get: () => undefined } }
      ]
    }).compile();

    service = module.get(TransactionsService);
  });

  it('rejects TRANSFER when source equals target', async () => {
    await expect(
      service.request({
        type: TransactionType.TRANSFER,
        amount: 100,
        sourceAccountId: '11111111-1111-1111-1111-111111111111',
        targetAccountId: '11111111-1111-1111-1111-111111111111'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists PENDING transaction and emits TransactionRequested', async () => {
    repo.create.mockResolvedValue({
      id: 't-1',
      type: TransactionType.TRANSFER,
      status: TransactionStatus.PENDING,
      amount: new Prisma.Decimal('500'),
      sourceAccountId: 'a-1',
      targetAccountId: 'a-2',
      requestedAt: new Date('2026-01-01T00:00:00Z'),
      completedAt: null,
      rejectedAt: null,
      reason: null
    });

    await service.request({
      type: TransactionType.TRANSFER,
      amount: 500,
      sourceAccountId: '11111111-1111-1111-1111-111111111111',
      targetAccountId: '22222222-2222-2222-2222-222222222222'
    });

    expect(producer.emit).toHaveBeenCalledWith(
      TOPICS.TRANSACTION_REQUESTED,
      't-1',
      expect.objectContaining({ id: 't-1', amount: '500' })
    );
  });
});
