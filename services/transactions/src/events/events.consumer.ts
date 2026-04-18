import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { IdempotencyService } from '../common/kafka/idempotency.service';
import { DlqService, asUnrecoverable } from '../common/kafka/dlq.service';
import { TOPICS } from '../common/kafka/topics';
import { BalanceUpdatedEvent, TransactionsService } from '../transactions/transactions.service';

@Controller()
export class EventsConsumer {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly idempotency: IdempotencyService,
    private readonly dlq: DlqService
  ) {}

  @EventPattern(TOPICS.BALANCE_UPDATED)
  async onBalanceUpdated(
    @Payload() payload: BalanceUpdatedEvent,
    @Ctx() ctx: KafkaContext
  ): Promise<void> {
    const topic = ctx.getTopic();
    const key = payload?.transactionId ?? 'unknown';

    await this.dlq.process(topic, key, payload, async () => {
      if (!payload?.transactionId) {
        throw asUnrecoverable(new Error('Malformed BalanceUpdated payload'));
      }

      const eventId = `${payload.transactionId}:${payload.updatedAt}`;

      const outcome = await this.idempotency.execute(eventId, topic, (tx) =>
        this.transactionsService.applyBalanceUpdate(payload, tx)
      );

      if (outcome) {
        await this.transactionsService.publishOutcome(outcome);
      }
    });
  }
}
