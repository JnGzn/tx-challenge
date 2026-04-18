import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { IdempotencyService } from '../common/kafka/idempotency.service';
import { DlqService, asUnrecoverable } from '../common/kafka/dlq.service';
import { TOPICS } from '../common/kafka/topics';
import { ExplanationsService } from '../explanations/explanations.service';

type TransactionOutcomeEvent = {
  transactionId: string;
  type?: string;
  amount?: string;
  sourceAccountId?: string;
  targetAccountId?: string;
  reason?: string;
  completedAt?: string;
  rejectedAt?: string;
};

@Controller()
export class EventsConsumer {
  constructor(
    private readonly explanations: ExplanationsService,
    private readonly idempotency: IdempotencyService,
    private readonly dlq: DlqService
  ) {}

  @EventPattern(TOPICS.TRANSACTION_COMPLETED)
  async onCompleted(
    @Payload() payload: TransactionOutcomeEvent,
    @Ctx() ctx: KafkaContext
  ): Promise<void> {
    await this.handle(ctx, payload);
  }

  @EventPattern(TOPICS.TRANSACTION_REJECTED)
  async onRejected(
    @Payload() payload: TransactionOutcomeEvent,
    @Ctx() ctx: KafkaContext
  ): Promise<void> {
    await this.handle(ctx, payload);
  }

  private async handle(ctx: KafkaContext, payload: TransactionOutcomeEvent): Promise<void> {
    const topic = ctx.getTopic();
    const eventId = this.buildEventId(ctx, payload);

    await this.dlq.process(topic, eventId, payload, async () => {
      if (!payload?.transactionId) {
        throw asUnrecoverable(new Error(`Malformed payload on ${topic}`));
      }

      const accountId = payload.sourceAccountId ?? payload.targetAccountId;

      const sanitizedPayload: Record<string, unknown> = {
        transactionId: String(payload.transactionId),
        ...(payload.type !== undefined        && { type:            String(payload.type) }),
        ...(payload.amount !== undefined      && { amount:          String(payload.amount) }),
        ...(payload.sourceAccountId !== undefined && { sourceAccountId: String(payload.sourceAccountId) }),
        ...(payload.targetAccountId !== undefined && { targetAccountId: String(payload.targetAccountId) }),
        ...(payload.reason !== undefined      && { reason:          String(payload.reason) }),
        ...(payload.completedAt !== undefined  && { completedAt:     String(payload.completedAt) }),
        ...(payload.rejectedAt !== undefined   && { rejectedAt:      String(payload.rejectedAt) })
      };

      await this.idempotency.execute(eventId, topic, async (tx) => {
        await this.explanations.persist(tx, {
          eventId,
          eventType: topic,
          transactionId: payload.transactionId,
          accountId,
          payload: sanitizedPayload
        });
      });
    });
  }

  private buildEventId(ctx: KafkaContext, payload: TransactionOutcomeEvent): string {
    const topic = ctx.getTopic();
    const partition = ctx.getPartition();
    const offset = ctx.getMessage()?.offset;
    if (offset === undefined || offset === null) {
      throw asUnrecoverable(new Error(`Missing Kafka offset on topic ${topic} — cannot guarantee idempotency`));
    }
    return `${topic}:${partition}:${offset}`;
  }
}
