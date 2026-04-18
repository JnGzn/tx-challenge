import { Account } from '@prisma/client';

export const ACCOUNT_REPOSITORY = Symbol('IAccountRepository');

export interface CreateAccountData {
  clientId: string;
  number: string;
  initialBalance: number;
}

export interface IAccountRepository {
  create(data: CreateAccountData): Promise<Account>;
  findById(id: string): Promise<Account | null>;
  findManyByClientId(clientId: string): Promise<Account[]>;
}
