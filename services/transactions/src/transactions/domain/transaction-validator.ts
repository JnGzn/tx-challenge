import { BadRequestException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';

export interface TransactionRules {
  type: TransactionType;
  sourceAccountId?: string;
  targetAccountId?: string;
}

type Rule = (input: TransactionRules) => string | null;

const requiresTarget: Rule = (t) =>
  t.type === TransactionType.DEPOSIT && !t.targetAccountId
    ? 'DEPOSIT requires targetAccountId'
    : null;

const requiresSource: Rule = (t) =>
  t.type === TransactionType.WITHDRAWAL && !t.sourceAccountId
    ? 'WITHDRAWAL requires sourceAccountId'
    : null;

const transferNeedsBoth: Rule = (t) =>
  t.type === TransactionType.TRANSFER && (!t.sourceAccountId || !t.targetAccountId)
    ? 'TRANSFER requires sourceAccountId and targetAccountId'
    : null;

const transferEndpointsDiffer: Rule = (t) =>
  t.type === TransactionType.TRANSFER && t.sourceAccountId === t.targetAccountId
    ? 'TRANSFER source and target must differ'
    : null;

const RULES: readonly Rule[] = [
  requiresTarget,
  requiresSource,
  transferNeedsBoth,
  transferEndpointsDiffer
];

export function validateTransactionRules(input: TransactionRules): void {
  for (const rule of RULES) {
    const error = rule(input);
    if (error) throw new BadRequestException(error);
  }
}
