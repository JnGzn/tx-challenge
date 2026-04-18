import { Injectable, Logger } from '@nestjs/common';
import { KafkaProducer } from './kafka.producer';
import { dlqTopicFor } from './topics';

type UnrecoverableTag = { __unrecoverable: true };
export type UnrecoverableError = Error & UnrecoverableTag;

export const asUnrecoverable = (error: Error): UnrecoverableError => {
  (error as UnrecoverableError).__unrecoverable = true;
  return error as UnrecoverableError;
};

export const isUnrecoverable = (error: unknown): error is UnrecoverableError =>
  !!error && typeof error === 'object' && (error as UnrecoverableTag).__unrecoverable === true;

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(private readonly producer: KafkaProducer) {}

  async process<T>(topic: string, key: string, payload: unknown, handler: () => Promise<T>): Promise<T | void> {
    try {
      return await handler();
    } catch (error) {
      if (isUnrecoverable(error)) {
        this.logger.error(
          `Unrecoverable error on ${topic} — routing to DLQ. Reason: ${(error as Error).message}`
        );
        await this.producer.emit(dlqTopicFor(topic), key, {
          originalTopic: topic,
          reason: (error as Error).message,
          payload,
          failedAt: new Date().toISOString()
        });
        return;
      }
      throw error;
    }
  }
}
