import { Injectable } from '@nestjs/common';
import { Client } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateClientData, IClientRepository } from '../domain/client.repository';

@Injectable()
export class PrismaClientRepository implements IClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateClientData): Promise<Client> {
    return this.prisma.client.create({ data });
  }

  findById(id: string): Promise<Client | null> {
    return this.prisma.client.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<Client | null> {
    return this.prisma.client.findUnique({ where: { email } });
  }
}
