import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { LLM_PROVIDER } from '../src/llm/llm-provider';

describe('Explanations (e2e)', () => {
  let app: INestApplication;
  const sampleEvent = {
    id: 'row-1',
    eventId: 'transaction.completed:0:42',
    eventType: 'transaction.completed',
    transactionId: '11111111-1111-1111-1111-111111111111',
    accountId: null,
    payload: { amount: '500' },
    createdAt: new Date('2026-01-01T00:00:00Z')
  };
  const prisma = {
    event: {
      findMany: jest.fn()
    }
  };
  const llm = {
    complete: jest.fn()
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(LLM_PROVIDER)
      .useValue(llm)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /explanations/transaction/:id returns explanation + event list', async () => {
    prisma.event.findMany.mockResolvedValueOnce([sampleEvent]);
    llm.complete.mockResolvedValueOnce({ text: 'Transferencia completada por $500.', model: 'gemini-2.0-flash', raw: {} });

    const res = await request(app.getHttpServer())
      .get('/explanations/transaction/11111111-1111-1111-1111-111111111111')
      .expect(200);

    expect(res.body).toMatchObject({
      transactionId: '11111111-1111-1111-1111-111111111111',
      explanation: 'Transferencia completada por $500.',
      model: 'gemini-2.0-flash'
    });
    expect(res.body.events).toHaveLength(1);
    expect(llm.complete).toHaveBeenCalledTimes(1);
    const [request_] = llm.complete.mock.calls[0];
    expect(request_.user).toContain('"amount": "500"');
  });

  afterAll(async () => {
    await app.close();
  });
});
