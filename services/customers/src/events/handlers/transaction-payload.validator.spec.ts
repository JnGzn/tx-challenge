import { isUnrecoverable } from '../../common/kafka/dlq.service';
import { validateTransactionPayload } from './transaction-payload.validator';

describe('validateTransactionPayload', () => {
  const base = {
    id: 'tx-1',
    type: 'DEPOSIT' as const,
    amount: '10',
    targetAccountId: 'a-1',
    requestedAt: '2026-01-01T00:00:00Z'
  };

  const expectUnrecoverable = (fn: () => void, match: RegExp | string) => {
    try {
      fn();
      fail('expected to throw');
    } catch (e: any) {
      expect(isUnrecoverable(e)).toBe(true);
      expect(e.message).toMatch(match);
    }
  };

  it('passes on a valid DEPOSIT', () => {
    expect(() => validateTransactionPayload(base)).not.toThrow();
  });

  it('rejects missing identity fields', () => {
    expectUnrecoverable(
      () => validateTransactionPayload({ ...base, id: '' } as any),
      /Malformed/
    );
    expectUnrecoverable(
      () => validateTransactionPayload({ ...base, type: '' } as any),
      /Malformed/
    );
    expectUnrecoverable(
      () => validateTransactionPayload({ ...base, amount: '' } as any),
      /Malformed/
    );
  });

  it('rejects non-positive or non-finite amount', () => {
    expectUnrecoverable(
      () => validateTransactionPayload({ ...base, amount: '0' }),
      /Invalid amount/
    );
    expectUnrecoverable(
      () => validateTransactionPayload({ ...base, amount: '-5' }),
      /Invalid amount/
    );
    expectUnrecoverable(
      () => validateTransactionPayload({ ...base, amount: 'abc' }),
      /Invalid amount/
    );
  });

  it('requires targetAccountId on DEPOSIT', () => {
    expectUnrecoverable(
      () =>
        validateTransactionPayload({
          ...base,
          targetAccountId: undefined as any
        }),
      /DEPOSIT requires targetAccountId/
    );
  });

  it('requires sourceAccountId on WITHDRAWAL', () => {
    expectUnrecoverable(
      () =>
        validateTransactionPayload({
          ...base,
          type: 'WITHDRAWAL',
          targetAccountId: undefined,
          sourceAccountId: undefined
        } as any),
      /WITHDRAWAL requires sourceAccountId/
    );
  });

  it('requires both endpoints on TRANSFER', () => {
    expectUnrecoverable(
      () =>
        validateTransactionPayload({
          ...base,
          type: 'TRANSFER',
          targetAccountId: 'a-2',
          sourceAccountId: undefined
        } as any),
      /TRANSFER requires sourceAccountId and targetAccountId/
    );
  });

  it('rejects TRANSFER with same source and target', () => {
    expectUnrecoverable(
      () =>
        validateTransactionPayload({
          ...base,
          type: 'TRANSFER',
          sourceAccountId: 'a-1',
          targetAccountId: 'a-1'
        }),
      /source and target must differ/
    );
  });

  it('accepts a valid TRANSFER', () => {
    expect(() =>
      validateTransactionPayload({
        ...base,
        type: 'TRANSFER',
        sourceAccountId: 'a-1',
        targetAccountId: 'a-2'
      })
    ).not.toThrow();
  });
});
