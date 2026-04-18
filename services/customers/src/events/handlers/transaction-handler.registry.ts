import { Inject, Injectable } from '@nestjs/common';
import { ITransactionHandler, TRANSACTION_HANDLER } from './transaction-handler';
import { TransactionKind } from './transaction.types';

@Injectable()
export class TransactionHandlerRegistry {
  private readonly byType: ReadonlyMap<TransactionKind, ITransactionHandler>;

  constructor(@Inject(TRANSACTION_HANDLER) handlers: ITransactionHandler[]) {
    const map = new Map<TransactionKind, ITransactionHandler>();
    for (const handler of handlers) {
      if (map.has(handler.type)) {
        throw new Error(`Duplicate TransactionHandler for type ${handler.type}`);
      }
      map.set(handler.type, handler);
    }
    this.byType = map;
  }

  resolve(type: TransactionKind): ITransactionHandler {
    const handler = this.byType.get(type);
    if (!handler) throw new Error(`No handler registered for type ${type}`);
    return handler;
  }
}
