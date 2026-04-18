import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExplanationsService } from './explanations.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { LLM_PROVIDER } from '../llm/llm-provider';

describe('ExplanationsService', () => {
  let service: ExplanationsService;
  let prisma: { event: { findMany: jest.Mock } };
  let llm: { complete: jest.Mock };
  let configGet: jest.Mock;

  const buildService = async (historyLimit?: number) => {
    configGet = jest.fn().mockReturnValue(historyLimit);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExplanationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LLM_PROVIDER, useValue: llm },
        { provide: ConfigService, useValue: { get: configGet } }
      ]
    }).compile();
    return module.get(ExplanationsService);
  };

  beforeEach(async () => {
    prisma = { event: { findMany: jest.fn() } };
    llm = { complete: jest.fn() };
    service = await buildService();
  });

  describe('explainTransaction', () => {
    it('throws NotFoundException when no events', async () => {
      prisma.event.findMany.mockResolvedValue([]);
      await expect(service.explainTransaction('t-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(llm.complete).not.toHaveBeenCalled();
    });

    it('picks the completed prompt for the latest event', async () => {
      prisma.event.findMany.mockResolvedValue([
        {
          eventId: 'e1',
          eventType: 'transaction.completed',
          transactionId: 't-1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          payload: { amount: '100' }
        }
      ]);
      llm.complete.mockResolvedValue({ text: 'Completada.', model: 'm', raw: {} });

      const result = await service.explainTransaction('t-1');

      const [request] = llm.complete.mock.calls[0];
      expect(request.system).toMatch(/completadas/);
      expect(request.user).toContain('"amount": "100"');
      expect(result).toEqual({
        transactionId: 't-1',
        explanation: 'Completada.',
        events: [
          {
            eventId: 'e1',
            eventType: 'transaction.completed',
            createdAt: '2026-01-01T00:00:00.000Z'
          }
        ]
      });
    });

    it('picks the rejected prompt when latest event is rejected', async () => {
      prisma.event.findMany.mockResolvedValue([
        {
          eventId: 'e1',
          eventType: 'transaction.completed',
          transactionId: 't-1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          payload: {}
        },
        {
          eventId: 'e2',
          eventType: 'transaction.rejected',
          transactionId: 't-1',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          payload: { reason: 'insufficient funds' }
        }
      ]);
      llm.complete.mockResolvedValue({ text: 'Rechazada.', model: 'm', raw: {} });

      const result = await service.explainTransaction('t-1');

      const [request] = llm.complete.mock.calls[0];
      expect(request.system).toMatch(/rechazadas/);
      expect(result.explanation).toBe('Rechazada.');
      expect(result.events).toHaveLength(2);
    });
  });

  describe('summarizeAccount', () => {
    it('throws NotFoundException when there is no history', async () => {
      prisma.event.findMany.mockResolvedValue([]);
      await expect(service.summarizeAccount('a-1')).rejects.toBeInstanceOf(
        NotFoundException
      );
      expect(llm.complete).not.toHaveBeenCalled();
    });

    it('uses default history limit of 25 and returns accountId + summary', async () => {
      prisma.event.findMany.mockResolvedValue([
        {
          eventId: 'e1',
          eventType: 'transaction.completed',
          transactionId: 't-1',
          createdAt: new Date('2026-01-01'),
          payload: { amount: '10' }
        }
      ]);
      llm.complete.mockResolvedValue({ text: 'summary', model: 'm', raw: {} });

      const result = await service.summarizeAccount('a-1');

      expect(prisma.event.findMany).toHaveBeenCalledWith({
        where: { accountId: 'a-1' },
        orderBy: { createdAt: 'desc' },
        take: 25
      });
      const [request] = llm.complete.mock.calls[0];
      expect(request.user).toContain('a-1');
      expect(result).toEqual({ accountId: 'a-1', summary: 'summary' });
    });

    it('honors LLM_HISTORY_LIMIT from config', async () => {
      service = await buildService(5);
      prisma.event.findMany.mockResolvedValue([
        {
          eventId: 'e1',
          eventType: 'x',
          transactionId: 't-1',
          createdAt: new Date(),
          payload: {}
        }
      ]);
      llm.complete.mockResolvedValue({ text: 's', model: 'm', raw: {} });

      await service.summarizeAccount('a-1');

      expect(configGet).toHaveBeenCalledWith('LLM_HISTORY_LIMIT');
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('persist', () => {
    it('creates an event row with provided fields', async () => {
      const tx: any = { event: { create: jest.fn().mockResolvedValue({ id: 1 }) } };

      await service.persist(tx, {
        eventId: 'e-1',
        eventType: 'transaction.completed',
        transactionId: 't-1',
        accountId: 'a-1',
        payload: { k: 'v' }
      });

      expect(tx.event.create).toHaveBeenCalledWith({
        data: {
          eventId: 'e-1',
          eventType: 'transaction.completed',
          transactionId: 't-1',
          accountId: 'a-1',
          payload: { k: 'v' }
        }
      });
    });
  });
});
