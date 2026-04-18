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

  beforeEach(async () => {
    prisma = {
      event: { findMany: jest.fn() }
    };
    llm = { complete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExplanationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LLM_PROVIDER, useValue: llm },
        { provide: ConfigService, useValue: { get: () => undefined } }
      ]
    }).compile();

    service = module.get(ExplanationsService);
  });

  it('explainTransaction → 404 when no events', async () => {
    prisma.event.findMany.mockResolvedValue([]);
    await expect(service.explainTransaction('t-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('explainTransaction → uses the latest event to build the explanation (completed flavor)', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        eventId: 'e1',
        eventType: 'transaction.completed',
        transactionId: 't-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        payload: { amount: '100' }
      }
    ]);
    llm.complete.mockResolvedValue({ text: 'Completada por $100.', model: 'm', raw: {} });

    const result = await service.explainTransaction('t-1');

    expect(llm.complete).toHaveBeenCalledTimes(1);
    const [request] = llm.complete.mock.calls[0];
    expect(request.system).toContain('completed banking transaction');
    expect(request.user).toContain('"amount": "100"');
    expect(result.transactionId).toBe('t-1');
    expect(result.explanation).toBe('Completada por $100.');
    expect(result.events).toHaveLength(1);
  });

  it('explainTransaction → picks rejected flavor when latest event is rejected', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        eventId: 'e1',
        eventType: 'transaction.rejected',
        transactionId: 't-1',
        createdAt: new Date('2026-01-01'),
        payload: { reason: 'insufficient funds' }
      }
    ]);
    llm.complete.mockResolvedValue({ text: 'Rechazada.', model: 'm', raw: {} });

    const result = await service.explainTransaction('t-1');

    const [request] = llm.complete.mock.calls[0];
    expect(request.system).toContain('rejected banking transaction');
    expect(result.explanation).toBe('Rechazada.');
  });

  it('summarizeAccount → calls LLM with recent events', async () => {
    prisma.event.findMany.mockResolvedValue([
      {
        eventId: 'e1',
        eventType: 'transaction.completed',
        transactionId: 't-1',
        createdAt: new Date('2026-01-01'),
        payload: {}
      }
    ]);
    llm.complete.mockResolvedValue({ text: 'summary', model: 'gemini-2.0-flash', raw: {} });

    const result = await service.summarizeAccount('a-1');

    expect(result).toEqual({ accountId: 'a-1', summary: 'summary', model: 'gemini-2.0-flash' });
    const [request] = llm.complete.mock.calls[0];
    expect(request.user).toContain('a-1');
  });
});
