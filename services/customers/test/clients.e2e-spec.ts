import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { KafkaProducer } from '../src/common/kafka/kafka.producer';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Clients (e2e)', () => {
  let app: INestApplication;
  const producer = { emit: jest.fn().mockResolvedValue(undefined) };
  const existingClient = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
  };
  const prisma = {
    client: {
      create: jest.fn(),
      findUnique: jest.fn()
    },
    account: {
      findMany: jest.fn().mockResolvedValue([])
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /clients creates a client and emits ClientCreated', async () => {
    prisma.client.create.mockResolvedValueOnce(existingClient);

    const res = await request(app.getHttpServer())
      .post('/clients')
      .send({ name: 'Ada Lovelace', email: 'ada@example.com' })
      .expect(201);

    expect(res.body).toMatchObject({ email: 'ada@example.com' });
    expect(producer.emit).toHaveBeenCalledWith(
      'client.created',
      existingClient.id,
      expect.any(Object)
    );
  });

  it('POST /clients returns 409 when email already exists', async () => {
    prisma.client.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test'
      })
    );

    await request(app.getHttpServer())
      .post('/clients')
      .send({ name: 'Ada Lovelace', email: 'ada@example.com' })
      .expect(409);

    expect(producer.emit).not.toHaveBeenCalled();
  });

  it('GET /clients?email= returns the client', async () => {
    prisma.client.findUnique.mockResolvedValueOnce(existingClient);

    const res = await request(app.getHttpServer())
      .get('/clients')
      .query({ email: 'ada@example.com' })
      .expect(200);

    expect(res.body).toMatchObject({ email: 'ada@example.com' });
    expect(prisma.client.findUnique).toHaveBeenCalledWith({
      where: { email: 'ada@example.com' }
    });
  });

  it('GET /clients?email= returns 404 when not found', async () => {
    prisma.client.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .get('/clients')
      .query({ email: 'missing@example.com' })
      .expect(404);
  });

  afterAll(async () => {
    await app.close();
  });
});
