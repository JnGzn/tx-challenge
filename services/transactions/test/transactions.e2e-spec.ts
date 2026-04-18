import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { KafkaProducer } from '../src/common/kafka/kafka.producer';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Transactions (e2e)', () => {
  let app: INestApplication;
  const producer = { emit: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    transaction: {
      create: jest.fn().mockResolvedValue({
        id: 't-1',
        type: TransactionType.TRANSFER,
        status: TransactionStatus.PENDING,
        amount: new Prisma.Decimal('500'),
        sourceAccountId: '11111111-1111-1111-1111-111111111111',
        targetAccountId: '22222222-2222-2222-2222-222222222222',
        requestedAt: new Date('2026-01-01T00:00:00Z'),
        completedAt: null,
        rejectedAt: null,
        reason: null
      })
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KafkaProducer)
      .useValue(producer)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  it('POST /transactions accepts a TRANSFER and emits TransactionRequested', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .send({
        type: 'TRANSFER',
        amount: 500,
        sourceAccountId: '11111111-1111-1111-1111-111111111111',
        targetAccountId: '22222222-2222-2222-2222-222222222222'
      })
      .expect(201);

    expect(producer.emit).toHaveBeenCalledWith('transaction.requested', 't-1', expect.any(Object));
  });

  afterAll(async () => {
    await app.close();
  });
});
