import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ExplanationsController } from '../src/explanations/explanations.controller';
import { ExplanationsService } from '../src/explanations/explanations.service';

describe('Explanations (e2e)', () => {
  let app: INestApplication;
  const service = {
    explainTransaction: jest.fn(),
    summarizeAccount: jest.fn()
  };
  const txId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExplanationsController],
      providers: [{ provide: ExplanationsService, useValue: service }]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /explanations/transaction/:id returns explanation', async () => {
    service.explainTransaction.mockResolvedValueOnce({
      transactionId: txId,
      explanation: 'Transferencia completada por $500.',
      events: [{ eventId: 'e-1', eventType: 'transaction.completed', createdAt: '2024-01-01T00:00:00.000Z' }]
    });

    const res = await request(app.getHttpServer())
      .get(`/explanations/transaction/${txId}`)
      .expect(200);

    expect(res.body).toMatchObject({
      transactionId: txId,
      explanation: 'Transferencia completada por $500.'
    });
  });

  it('GET /explanations/transaction/:id returns 404 when not found', async () => {
    service.explainTransaction.mockRejectedValueOnce(new NotFoundException());

    await request(app.getHttpServer())
      .get(`/explanations/transaction/${txId}`)
      .expect(404);
  });

  it('GET /explanations/account/:id/summary returns summary', async () => {
    service.summarizeAccount.mockResolvedValueOnce({
      accountId,
      summary: 'Actividad reciente: 3 depósitos.'
    });

    const res = await request(app.getHttpServer())
      .get(`/explanations/account/${accountId}/summary`)
      .expect(200);

    expect(res.body).toMatchObject({
      accountId,
      summary: 'Actividad reciente: 3 depósitos.'
    });
  });

  it('GET /explanations/account/:id/summary returns 404 when not found', async () => {
    service.summarizeAccount.mockRejectedValueOnce(new NotFoundException());

    await request(app.getHttpServer())
      .get(`/explanations/account/${accountId}/summary`)
      .expect(404);
  });
});
