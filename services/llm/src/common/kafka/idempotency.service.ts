import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type TransactionalHandler<T> = (tx: Prisma.TransactionClient) => Promise<T>;

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(eventId: string, topic: string, handler: TransactionalHandler<T>): Promise<T | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { id: eventId, topic } });
        return handler(tx);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.logger.debug(`Event ${eventId} on ${topic} already processed — skipping`);
        return null;
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
