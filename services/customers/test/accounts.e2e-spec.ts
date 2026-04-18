import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountsController } from '../src/accounts/accounts.controller';
import { AccountsService } from '../src/accounts/accounts.service';

describe('Accounts (e2e)', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(),
    findOne: jest.fn(),
    getBalance: jest.fn()
  };
  const accountId = '11111111-1111-1111-1111-111111111111';
  const clientId = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: service }]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('POST /accounts creates an account', async () => {
    service.create.mockResolvedValueOnce({ id: accountId, clientId, balance: '0.00' });

    const res = await request(app.getHttpServer())
      .post('/accounts')
      .send({ clientId })
      .expect(201);

    expect(res.body).toMatchObject({ id: accountId, clientId });
  });

  it('GET /accounts/:id returns the account', async () => {
    service.findOne.mockResolvedValueOnce({ id: accountId, clientId, balance: '100.00' });

    const res = await request(app.getHttpServer())
      .get(`/accounts/${accountId}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: accountId });
  });

  it('GET /accounts/:id returns 404 when not found', async () => {
    service.findOne.mockRejectedValueOnce(new NotFoundException());

    await request(app.getHttpServer())
      .get(`/accounts/${accountId}`)
      .expect(404);
  });

  it('GET /accounts/:id/balance returns the balance', async () => {
    service.getBalance.mockResolvedValueOnce({ id: accountId, balance: '100.00' });

    const res = await request(app.getHttpServer())
      .get(`/accounts/${accountId}/balance`)
      .expect(200);

    expect(res.body).toMatchObject({ id: accountId, balance: '100.00' });
  });

  it('GET /accounts/:id/balance returns 404 when not found', async () => {
    service.getBalance.mockRejectedValueOnce(new NotFoundException());

    await request(app.getHttpServer())
      .get(`/accounts/${accountId}/balance`)
      .expect(404);
  });
});
