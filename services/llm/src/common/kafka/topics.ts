export const TOPICS = {
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_REJECTED: 'transaction.rejected'
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

export const dlqTopicFor = (topic: string): string => `${topic}.dlq`;

export const KAFKA_PRODUCER = 'KAFKA_PRODUCER';
