import { Test, TestingModule } from '@nestjs/testing';
import { TransactionType } from '@prisma/client';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: { request: jest.Mock; findOne: jest.Mock; list: jest.Mock };

  beforeEach(async () => {
    service = {
      request: jest.fn(),
      findOne: jest.fn(),
      list: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: service }]
    }).compile();

    controller = module.get(TransactionsController);
  });

  it('sanitizes the DTO before delegating to request', async () => {
    const tx = { id: 't-1' };
    service.request.mockResolvedValue(tx);

    const dto: any = {
      type: TransactionType.DEPOSIT,
      amount: 100,
      sourceAccountId: undefined,
      targetAccountId: '22222222-2222-2222-2222-222222222222',
      idempotencyKey: '33333333-3333-3333-3333-333333333333',
      extraField: 'should-be-stripped'
    };

    await expect(controller.create(dto)).resolves.toBe(tx);
    expect(service.request).toHaveBeenCalledWith({
      type: TransactionType.DEPOSIT,
      amount: 100,
      sourceAccountId: undefined,
      targetAccountId: '22222222-2222-2222-2222-222222222222',
      idempotencyKey: '33333333-3333-3333-3333-333333333333'
    });
  });

  it('delegates findOne to the service', async () => {
    service.findOne.mockResolvedValue({ id: 't-1' });
    await expect(controller.findOne('t-1')).resolves.toEqual({ id: 't-1' });
    expect(service.findOne).toHaveBeenCalledWith('t-1');
  });

  it('delegates list to the service', async () => {
    service.list.mockResolvedValue([]);
    await expect(controller.list({})).resolves.toEqual([]);
    expect(service.list).toHaveBeenCalledWith({});
  });
});
