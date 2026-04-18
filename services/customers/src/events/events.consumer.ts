import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { Prisma } from '@prisma/client';
import { KafkaProducer } from '../common/kafka/kafka.producer';
import { IdempotencyService } from '../common/kafka/idempotency.service';
import { DlqService, asUnrecoverable } from '../common/kafka/dlq.service';
import { TOPICS } from '../common/kafka/topics';
import { TransactionHandlerRegistry } from './handlers/transaction-handler.registry';
import { validateTransactionPayload } from './handlers/transaction-payload.validator';
import { assertTransactionKind, TransactionRequestedPayload } from './handlers/transaction.types';

@Controller()
export class EventsConsumer {
  constructor(
    private readonly producer: KafkaProducer,
    private readonly idempotency: IdempotencyService,
    private readonly dlq: DlqService,
    private readonly handlers: TransactionHandlerRegistry
  ) {}

  @EventPattern(TOPICS.TRANSACTION_REQUESTED)
  async onTransactionRequested(
    @Payload() payload: TransactionRequestedPayload,
    @Ctx() ctx: KafkaContext
  ): Promise<void> {
    const topic = ctx.getTopic();
    const key = payload?.id ?? 'unknown';

    await this.dlq.process(topic, key, payload, async () => {
      validateTransactionPayload(payload);
      assertTransactionKind(payload.type);

      let amount: Prisma.Decimal;
      try {
        amount = new Prisma.Decimal(payload.amount);
      } catch {
        throw asUnrecoverable(new Error(`Invalid amount format: ${payload.amount}`));
      }

      const handler = this.handlers.resolve(payload.type);

      const result = await this.idempotency.execute(payload.id, topic, (tx) =>
        handler.apply({ tx, payload, amount })
      );

      if (result) {
        await this.producer.emit(TOPICS.BALANCE_UPDATED, payload.id, result);
      }
    });
  }
}
