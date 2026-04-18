import { Test, TestingModule } from '@nestjs/testing';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

describe('ClientsController', () => {
  let controller: ClientsController;
  let service: {
    create: jest.Mock;
    findByEmail: jest.Mock;
    listAccountsByEmail: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      listAccountsByEmail: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClientsController],
      providers: [{ provide: ClientsService, useValue: service }]
    }).compile();

    controller = module.get(ClientsController);
  });

  it('delegates create to the service', async () => {
    const created = { id: 'c-1', name: 'Ada', email: 'ada@example.com' };
    service.create.mockResolvedValue(created);

    await expect(
      controller.create({ name: 'Ada', email: 'ada@example.com' })
    ).resolves.toBe(created);
    expect(service.create).toHaveBeenCalledWith({
      name: 'Ada',
      email: 'ada@example.com'
    });
  });

  it('forwards email query to findByEmail', async () => {
    const client = { id: 'c-1', email: 'ada@example.com' };
    service.findByEmail.mockResolvedValue(client);

    await expect(
      controller.findByEmail({ email: 'ada@example.com' })
    ).resolves.toBe(client);
    expect(service.findByEmail).toHaveBeenCalledWith('ada@example.com');
  });

  it('lists accounts via listAccountsByEmail', async () => {
    const accounts = [{ id: 'a-1' }];
    service.listAccountsByEmail.mockResolvedValue(accounts);

    await expect(
      controller.listAccounts({ email: 'ada@example.com' })
    ).resolves.toBe(accounts);
    expect(service.listAccountsByEmail).toHaveBeenCalledWith('ada@example.com');
  });
});
