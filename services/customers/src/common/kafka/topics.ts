export const TOPICS = {
  CLIENT_CREATED: 'client.created',
  ACCOUNT_CREATED: 'account.created',
  BALANCE_UPDATED: 'balance.updated',
  TRANSACTION_REQUESTED: 'transaction.requested',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_REJECTED: 'transaction.rejected'
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

export const dlqTopicFor = (topic: string): string => `${topic}.dlq`;

export const KAFKA_PRODUCER = 'KAFKA_PRODUCER';
