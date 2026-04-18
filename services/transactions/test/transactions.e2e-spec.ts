import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TransactionsController } from '../src/transactions/transactions.controller';
import { TransactionsService } from '../src/transactions/transactions.service';

describe('Transactions (e2e)', () => {
  let app: INestApplication;
  const service = {
    request: jest.fn(),
    findOne: jest.fn(),
    list: jest.fn()
  };
  const txId = '11111111-1111-1111-1111-111111111111';
  const sourceAccountId = '22222222-2222-2222-2222-222222222222';
  const targetAccountId = '33333333-3333-3333-3333-333333333333';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: service }]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('POST /transactions creates a transaction', async () => {
    service.request.mockResolvedValueOnce({ id: txId, type: 'TRANSFER', status: 'PENDING' });

    const res = await request(app.getHttpServer())
      .post('/transactions')
      .send({ type: 'TRANSFER', amount: 500, sourceAccountId, targetAccountId })
      .expect(201);

    expect(res.body).toMatchObject({ id: txId, status: 'PENDING' });
  });

  it('GET /transactions/:id returns the transaction', async () => {
    service.findOne.mockResolvedValueOnce({ id: txId, status: 'COMPLETED' });

    const res = await request(app.getHttpServer())
      .get(`/transactions/${txId}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: txId, status: 'COMPLETED' });
  });

  it('GET /transactions/:id returns 404 when not found', async () => {
    service.findOne.mockRejectedValueOnce(new NotFoundException());

    await request(app.getHttpServer())
      .get(`/transactions/${txId}`)
      .expect(404);
  });

  it('GET /transactions returns list', async () => {
    service.list.mockResolvedValueOnce([{ id: txId, status: 'COMPLETED' }]);

    const res = await request(app.getHttpServer())
      .get('/transactions')
      .expect(200);

    expect(res.body).toMatchObject([{ id: txId, status: 'COMPLETED' }]);
  });
});
