import { Client } from '@prisma/client';

export const CLIENT_REPOSITORY = Symbol('IClientRepository');

export interface CreateClientData {
  name: string;
  email: string;
}

export interface IClientRepository {
  create(data: CreateClientData): Promise<Client>;
  findById(id: string): Promise<Client | null>;
  findByEmail(email: string): Promise<Client | null>;
}
