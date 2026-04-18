import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Event, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ILLMProvider, LLM_PROVIDER } from '../llm/llm-provider';
import { prompts } from './explanations.prompts';

export type TransactionExplanation = {
  transactionId: string;
  explanation: string;
  events: Array<{
    eventId: string;
    eventType: string;
    createdAt: string;
  }>;
};

export type AccountSummary = {
  accountId: string;
  summary: string;
};

const DEFAULT_HISTORY_LIMIT = 25;

@Injectable()
export class ExplanationsService {
  private readonly historyLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LLM_PROVIDER) private readonly llm: ILLMProvider,
    config: ConfigService
  ) {
    this.historyLimit =
      config.get<number>('LLM_HISTORY_LIMIT') ?? DEFAULT_HISTORY_LIMIT;
  }

  async explainTransaction(transactionId: string): Promise<TransactionExplanation> {
    const events = await this.prisma.event.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'asc' }
    });
    if (events.length === 0) {
      throw new NotFoundException(`No events for transaction ${transactionId}`);
    }

    const latest = events[events.length - 1];
    const payload = latest.payload as Record<string, unknown>;
    const request =
      latest.eventType === 'transaction.rejected'
        ? prompts.rejected(payload)
        : prompts.completed(payload);

    const result = await this.llm.complete(request);

    return {
      transactionId,
      explanation: result.text,
      events: events.map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        createdAt: e.createdAt.toISOString()
      }))
    };
  }

  async summarizeAccount(accountId: string): Promise<AccountSummary> {
    const events = await this.prisma.event.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: this.historyLimit
    });
    if (events.length === 0) throw new NotFoundException(`No history for account ${accountId}`);

    const condensed = events.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      transactionId: e.transactionId,
      createdAt: e.createdAt.toISOString(),
      payload: e.payload
    }));

    const result = await this.llm.complete(prompts.accountHistory(accountId, condensed));
    return { accountId, summary: result.text};
  }

  async persist(
    tx: Prisma.TransactionClient,
    params: {
      eventId: string;
      eventType: string;
      transactionId?: string;
      accountId?: string;
      payload: Record<string, unknown>;
    }
  ): Promise<Event> {
    return tx.event.create({
      data: {
        eventId: params.eventId,
        eventType: params.eventType,
        transactionId: params.transactionId,
        accountId: params.accountId,
        payload: params.payload as Prisma.InputJsonValue
      }
    });
  }
}
