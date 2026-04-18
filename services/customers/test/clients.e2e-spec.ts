import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClientsController } from '../src/clients/clients.controller';
import { ClientsService } from '../src/clients/clients.service';

describe('Clients (e2e)', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    listAccountsByEmail: jest.fn()
  };
  const clientId = '11111111-1111-1111-1111-111111111111';
  const email = 'ada@example.com';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [{ provide: ClientsService, useValue: service }]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('POST /clients returns the created client', async () => {
    service.create.mockResolvedValueOnce({ id: clientId, name: 'Ada', email });

    const res = await request(app.getHttpServer())
      .post('/clients')
      .send({ name: 'Ada', email })
      .expect(201);

    expect(res.body).toMatchObject({ id: clientId, email });
  });

  it('GET /clients?email= returns the client', async () => {
    service.findByEmail.mockResolvedValueOnce({ id: clientId, email });

    const res = await request(app.getHttpServer())
      .get('/clients')
      .query({ email })
      .expect(200);

    expect(res.body).toMatchObject({ id: clientId, email });
  });

  it('GET /clients?email= returns 404 when not found', async () => {
    service.findByEmail.mockRejectedValueOnce(new NotFoundException());

    await request(app.getHttpServer())
      .get('/clients')
      .query({ email })
      .expect(404);
  });

  it('GET /clients/accounts?email= returns accounts', async () => {
    const accountId = '22222222-2222-2222-2222-222222222222';
    service.listAccountsByEmail.mockResolvedValueOnce([{ id: accountId, clientId }]);

    const res = await request(app.getHttpServer())
      .get('/clients/accounts')
      .query({ email })
      .expect(200);

    expect(res.body).toMatchObject([{ id: accountId }]);
  });
});
