import { asUnrecoverable } from '../../common/kafka/dlq.service';
import { TransactionRequestedPayload } from './transaction.types';

type Rule = (p: TransactionRequestedPayload) => string | null;

const hasIdentity: Rule = (p) =>
  !p?.id || !p?.type || !p?.amount ? 'Malformed TransactionRequested payload' : null;

const hasPositiveAmount: Rule = (p) => {
  const n = Number(p.amount);
  return !Number.isFinite(n) || n <= 0 ? `Invalid amount: ${p.amount}` : null;
};

const depositHasTarget: Rule = (p) =>
  p.type === 'DEPOSIT' && !p.targetAccountId ? 'DEPOSIT requires targetAccountId' : null;

const withdrawalHasSource: Rule = (p) =>
  p.type === 'WITHDRAWAL' && !p.sourceAccountId ? 'WITHDRAWAL requires sourceAccountId' : null;

const transferHasBoth: Rule = (p) =>
  p.type === 'TRANSFER' && (!p.sourceAccountId || !p.targetAccountId)
    ? 'TRANSFER requires sourceAccountId and targetAccountId'
    : null;

const transferEndpointsDiffer: Rule = (p) =>
  p.type === 'TRANSFER' && p.sourceAccountId === p.targetAccountId
    ? 'TRANSFER source and target must differ'
    : null;

const RULES: readonly Rule[] = [
  hasIdentity,
  hasPositiveAmount,
  depositHasTarget,
  withdrawalHasSource,
  transferHasBoth,
  transferEndpointsDiffer
];

export function validateTransactionPayload(payload: TransactionRequestedPayload): void {
  for (const rule of RULES) {
    const error = rule(payload);
    if (error) throw asUnrecoverable(new Error(error));
  }
}
