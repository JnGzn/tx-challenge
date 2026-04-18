import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: { create: jest.Mock; findOne: jest.Mock; getBalance: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findOne: jest.fn(),
      getBalance: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: service }]
    }).compile();

    controller = module.get(AccountsController);
  });

  it('delegates create to the service', async () => {
    const account = { id: 'a-1', clientId: 'c-1' };
    service.create.mockResolvedValue(account);

    await expect(
      controller.create({ clientId: 'c-1', initialBalance: 100 })
    ).resolves.toBe(account);
    expect(service.create).toHaveBeenCalledWith({
      clientId: 'c-1',
      initialBalance: 100
    });
  });

  it('delegates findOne to the service', async () => {
    const account = { id: 'a-1' };
    service.findOne.mockResolvedValue(account);

    await expect(controller.findOne('a-1')).resolves.toBe(account);
    expect(service.findOne).toHaveBeenCalledWith('a-1');
  });

  it('delegates balance to the service', async () => {
    service.getBalance.mockResolvedValue({ id: 'a-1', balance: '42.00' });

    await expect(controller.balance('a-1')).resolves.toEqual({
      id: 'a-1',
      balance: '42.00'
    });
    expect(service.getBalance).toHaveBeenCalledWith('a-1');
  });
});
