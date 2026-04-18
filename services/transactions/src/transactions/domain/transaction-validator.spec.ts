import { BadRequestException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { validateTransactionRules } from './transaction-validator';

describe('validateTransactionRules', () => {
  it('requires targetAccountId for DEPOSIT', () => {
    expect(() =>
      validateTransactionRules({ type: TransactionType.DEPOSIT })
    ).toThrow(BadRequestException);
  });

  it('requires sourceAccountId for WITHDRAWAL', () => {
    expect(() =>
      validateTransactionRules({ type: TransactionType.WITHDRAWAL })
    ).toThrow(/WITHDRAWAL requires sourceAccountId/);
  });

  it('requires both endpoints for TRANSFER', () => {
    expect(() =>
      validateTransactionRules({
        type: TransactionType.TRANSFER,
        sourceAccountId: 'a-1'
      })
    ).toThrow(/TRANSFER requires sourceAccountId and targetAccountId/);
  });

  it('rejects TRANSFER with identical endpoints', () => {
    expect(() =>
      validateTransactionRules({
        type: TransactionType.TRANSFER,
        sourceAccountId: 'a-1',
        targetAccountId: 'a-1'
      })
    ).toThrow(/source and target must differ/);
  });

  it('accepts a valid DEPOSIT', () => {
    expect(() =>
      validateTransactionRules({
        type: TransactionType.DEPOSIT,
        targetAccountId: 'a-1'
      })
    ).not.toThrow();
  });

  it('accepts a valid TRANSFER', () => {
    expect(() =>
      validateTransactionRules({
        type: TransactionType.TRANSFER,
        sourceAccountId: 'a-1',
        targetAccountId: 'a-2'
      })
    ).not.toThrow();
  });
});
