import { TransactionHandlerRegistry } from './transaction-handler.registry';
import { ITransactionHandler } from './transaction-handler';

const makeHandler = (type: any): ITransactionHandler => ({
  type,
  apply: jest.fn()
});

describe('TransactionHandlerRegistry', () => {
  it('resolves handlers by type', () => {
    const deposit = makeHandler('DEPOSIT');
    const withdrawal = makeHandler('WITHDRAWAL');
    const registry = new TransactionHandlerRegistry([deposit, withdrawal]);

    expect(registry.resolve('DEPOSIT')).toBe(deposit);
    expect(registry.resolve('WITHDRAWAL')).toBe(withdrawal);
  });

  it('throws on duplicate handler types', () => {
    expect(
      () =>
        new TransactionHandlerRegistry([makeHandler('DEPOSIT'), makeHandler('DEPOSIT')])
    ).toThrow(/Duplicate TransactionHandler/);
  });

  it('throws when resolving unknown types', () => {
    const registry = new TransactionHandlerRegistry([makeHandler('DEPOSIT')]);
    expect(() => registry.resolve('TRANSFER' as any)).toThrow(/No handler registered/);
  });
});
