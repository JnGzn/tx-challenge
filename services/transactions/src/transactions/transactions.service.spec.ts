import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import {
  BalanceUpdatedEvent,
  TransactionsService
} from './transactions.service';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { KafkaProducer } from '../common/kafka/kafka.producer';
import { TOPICS } from '../common/kafka/topics';
import { isUnrecoverable } from '../common/kafka/dlq.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repo: { create: jest.Mock; findById: jest.Mock; findMany: jest.Mock };
  let producer: { emit: jest.Mock };
  let configGet: jest.Mock;

  const buildService = async (listLimit?: number) => {
    configGet = jest.fn().mockReturnValue(listLimit);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TRANSACTION_REPOSITORY, useValue: repo },
        { provide: KafkaProducer, useValue: producer },
        { provide: ConfigService, useValue: { get: configGet } }
      ]
    }).compile();
    return module.get(TransactionsService);
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn()
    };
    producer = { emit: jest.fn().mockResolvedValue(undefined) };
    service = await buildService();
  });

  describe('request', () => {
    it('rejects TRANSFER when source equals target', async () => {
      await expect(
        service.request({
          type: TransactionType.TRANSFER,
          amount: 100,
          sourceAccountId: '11111111-1111-1111-1111-111111111111',
          targetAccountId: '11111111-1111-1111-1111-111111111111'
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
      expect(producer.emit).not.toHaveBeenCalled();
    });

    it('persists PENDING transaction with nullish account fields normalized', async () => {
      repo.create.mockResolvedValue({
        id: 't-1',
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
        amount: new Prisma.Decimal('100'),
        sourceAccountId: null,
        targetAccountId: 'a-2',
        requestedAt: new Date('2026-01-01T00:00:00Z'),
        completedAt: null,
        rejectedAt: null,
        reason: null
      });

      await service.request({
        type: TransactionType.DEPOSIT,
        amount: 100,
        targetAccountId: '22222222-2222-2222-2222-222222222222',
        idempotencyKey: '33333333-3333-3333-3333-333333333333'
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '33333333-3333-3333-3333-333333333333',
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
          amount: expect.any(Prisma.Decimal)
        })
      );
      expect(producer.emit).toHaveBeenCalledWith(
        TOPICS.TRANSACTION_REQUESTED,
        't-1',
        expect.objectContaining({
          id: 't-1',
          amount: '100',
          sourceAccountId: undefined,
          targetAccountId: 'a-2'
        })
      );
    });

    it('persists TRANSFER and emits both account ids', async () => {
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
        expect.objectContaining({
          sourceAccountId: 'a-1',
          targetAccountId: 'a-2'
        })
      );
    });
  });

  describe('applyBalanceUpdate', () => {
    const buildTx = () => ({
      transaction: {
        findUnique: jest.fn(),
        update: jest.fn()
      }
    });

    const successPayload: BalanceUpdatedEvent = {
      transactionId: 't-1',
      type: 'DEPOSIT',
      success: true,
      movements: [
        {
          accountId: 'a-1',
          previousBalance: '0',
          newBalance: '100',
          delta: '100'
        }
      ],
      updatedAt: '2026-01-02T00:00:00Z'
    };

    it('throws unrecoverable when transaction does not exist', async () => {
      const tx = buildTx();
      tx.transaction.findUnique.mockResolvedValue(null);

      try {
        await service.applyBalanceUpdate(successPayload, tx as any);
        fail('should have thrown');
      } catch (e: any) {
        expect(isUnrecoverable(e)).toBe(true);
      }
    });

    it('returns null when transaction is not PENDING', async () => {
      const tx = buildTx();
      tx.transaction.findUnique.mockResolvedValue({
        id: 't-1',
        status: TransactionStatus.COMPLETED
      });

      await expect(
        service.applyBalanceUpdate(successPayload, tx as any)
      ).resolves.toBeNull();
      expect(tx.transaction.update).not.toHaveBeenCalled();
    });

    it('marks completed on success and returns completed outcome', async () => {
      const tx = buildTx();
      tx.transaction.findUnique.mockResolvedValue({
        id: 't-1',
        status: TransactionStatus.PENDING
      });
      tx.transaction.update.mockResolvedValue({
        id: 't-1',
        type: 'DEPOSIT',
        amount: new Prisma.Decimal('100'),
        sourceAccountId: null,
        targetAccountId: 'a-1',
        completedAt: new Date('2026-01-02T00:00:00Z')
      });

      const result = await service.applyBalanceUpdate(successPayload, tx as any);

      expect(tx.transaction.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: expect.objectContaining({ status: TransactionStatus.COMPLETED })
      });
      expect(result).toEqual(
        expect.objectContaining({
          kind: 'completed',
          transactionId: 't-1',
          amount: '100',
          targetAccountId: 'a-1',
          sourceAccountId: undefined,
          movements: successPayload.movements,
          completedAt: expect.any(String)
        })
      );
    });

    it('defaults movements/completedAt when update returns nulls', async () => {
      const tx = buildTx();
      tx.transaction.findUnique.mockResolvedValue({
        id: 't-1',
        status: TransactionStatus.PENDING
      });
      tx.transaction.update.mockResolvedValue({
        id: 't-1',
        type: 'DEPOSIT',
        amount: new Prisma.Decimal('5'),
        sourceAccountId: null,
        targetAccountId: null,
        completedAt: null
      });

      const result = await service.applyBalanceUpdate(
        { ...successPayload, movements: undefined },
        tx as any
      );

      expect(result).toEqual(
        expect.objectContaining({
          kind: 'completed',
          movements: [],
          completedAt: expect.any(String)
        })
      );
    });

    it('marks rejected on failure with provided reason', async () => {
      const tx = buildTx();
      tx.transaction.findUnique.mockResolvedValue({
        id: 't-1',
        status: TransactionStatus.PENDING
      });
      tx.transaction.update.mockResolvedValue({
        id: 't-1',
        type: 'WITHDRAWAL',
        amount: new Prisma.Decimal('50'),
        sourceAccountId: 'a-1',
        targetAccountId: null,
        reason: 'Insufficient funds',
        rejectedAt: new Date('2026-01-02T00:00:00Z')
      });

      const result = await service.applyBalanceUpdate(
        {
          transactionId: 't-1',
          type: 'WITHDRAWAL',
          success: false,
          reason: 'Insufficient funds',
          updatedAt: '2026-01-02T00:00:00Z'
        },
        tx as any
      );

      expect(tx.transaction.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: expect.objectContaining({
          status: TransactionStatus.REJECTED,
          reason: 'Insufficient funds'
        })
      });
      expect(result).toEqual(
        expect.objectContaining({
          kind: 'rejected',
          reason: 'Insufficient funds',
          sourceAccountId: 'a-1',
          targetAccountId: undefined,
          rejectedAt: expect.any(String)
        })
      );
    });

    it('defaults reason/rejectedAt when missing', async () => {
      const tx = buildTx();
      tx.transaction.findUnique.mockResolvedValue({
        id: 't-1',
        status: TransactionStatus.PENDING
      });
      tx.transaction.update.mockResolvedValue({
        id: 't-1',
        type: 'WITHDRAWAL',
        amount: new Prisma.Decimal('50'),
        sourceAccountId: null,
        targetAccountId: null,
        reason: null,
        rejectedAt: null
      });

      const result = await service.applyBalanceUpdate(
        {
          transactionId: 't-1',
          type: 'WITHDRAWAL',
          success: false,
          updatedAt: '2026-01-02T00:00:00Z'
        },
        tx as any
      );

      expect(result).toEqual(
        expect.objectContaining({
          kind: 'rejected',
          reason: 'Unknown reason',
          rejectedAt: expect.any(String)
        })
      );
    });
  });

  describe('publishOutcome', () => {
    it('emits TRANSACTION_COMPLETED for completed outcomes', async () => {
      await service.publishOutcome({
        kind: 'completed',
        transactionId: 't-1',
        type: 'DEPOSIT',
        amount: '100',
        movements: [],
        completedAt: '2026-01-02T00:00:00Z'
      });
      expect(producer.emit).toHaveBeenCalledWith(
        TOPICS.TRANSACTION_COMPLETED,
        't-1',
        expect.not.objectContaining({ kind: 'completed' })
      );
    });

    it('emits TRANSACTION_REJECTED for rejected outcomes', async () => {
      await service.publishOutcome({
        kind: 'rejected',
        transactionId: 't-1',
        type: 'DEPOSIT',
        amount: '100',
        reason: 'nope',
        rejectedAt: '2026-01-02T00:00:00Z'
      });
      expect(producer.emit).toHaveBeenCalledWith(
        TOPICS.TRANSACTION_REJECTED,
        't-1',
        expect.objectContaining({ reason: 'nope' })
      );
    });
  });

  describe('findOne', () => {
    it('returns the transaction when found', async () => {
      const tx = { id: 't-1' };
      repo.findById.mockResolvedValue(tx);
      await expect(service.findOne('t-1')).resolves.toBe(tx);
    });

    it('throws NotFoundException when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException
      );
    });
  });

  describe('list', () => {
    it('uses configured list limit', async () => {
      service = await buildService(25);
      repo.findMany.mockResolvedValue([]);

      await service.list({ status: TransactionStatus.PENDING });

      expect(configGet).toHaveBeenCalledWith('TRANSACTIONS_LIST_LIMIT');
      expect(repo.findMany).toHaveBeenCalledWith(
        { status: TransactionStatus.PENDING },
        25
      );
    });

    it('falls back to default limit of 100', async () => {
      repo.findMany.mockResolvedValue([]);
      await service.list({});
      expect(repo.findMany).toHaveBeenCalledWith({}, 100);
    });
  });
});
