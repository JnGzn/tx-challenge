import { Test, TestingModule } from '@nestjs/testing';
import { ExplanationsController } from './explanations.controller';
import { ExplanationsService } from './explanations.service';

describe('ExplanationsController', () => {
  let controller: ExplanationsController;
  let service: { explainTransaction: jest.Mock; summarizeAccount: jest.Mock };

  beforeEach(async () => {
    service = {
      explainTransaction: jest.fn(),
      summarizeAccount: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExplanationsController],
      providers: [{ provide: ExplanationsService, useValue: service }]
    }).compile();

    controller = module.get(ExplanationsController);
  });

  it('delegates explainTransaction', async () => {
    const out = { transactionId: 't-1', explanation: 'x', events: [] };
    service.explainTransaction.mockResolvedValue(out);

    await expect(controller.explainTransaction('t-1')).resolves.toBe(out);
    expect(service.explainTransaction).toHaveBeenCalledWith('t-1');
  });

  it('delegates summarize', async () => {
    const out = { accountId: 'a-1', summary: 's' };
    service.summarizeAccount.mockResolvedValue(out);

    await expect(controller.summarize('a-1')).resolves.toBe(out);
    expect(service.summarizeAccount).toHaveBeenCalledWith('a-1');
  });
});
