import { Logger } from '@nestjs/common';
import {
  asUnrecoverable,
  DlqService,
  isUnrecoverable
} from './dlq.service';

describe('DlqService', () => {
  let service: DlqService;
  let producer: { emit: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    producer = { emit: jest.fn().mockResolvedValue(undefined) };
    service = new DlqService(producer as any);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('tagging helpers', () => {
    it('asUnrecoverable tags errors and isUnrecoverable detects them', () => {
      const tagged = asUnrecoverable(new Error('boom'));
      expect(isUnrecoverable(tagged)).toBe(true);
      expect(isUnrecoverable(new Error('plain'))).toBe(false);
      expect(isUnrecoverable(null)).toBe(false);
      expect(isUnrecoverable('string')).toBe(false);
    });
  });

  it('returns handler result when no error', async () => {
    const result = await service.process('t', 'k', { a: 1 }, async () => 'ok');
    expect(result).toBe('ok');
    expect(producer.emit).not.toHaveBeenCalled();
  });

  it('routes unrecoverable errors to DLQ', async () => {
    const err = asUnrecoverable(new Error('fatal'));
    const result = await service.process('t', 'k', { a: 1 }, async () => {
      throw err;
    });
    expect(result).toBeUndefined();
    expect(producer.emit).toHaveBeenCalledWith(
      't.dlq',
      'k',
      expect.objectContaining({
        originalTopic: 't',
        reason: 'fatal',
        payload: { a: 1 },
        failedAt: expect.any(String)
      })
    );
  });

  it('rethrows recoverable errors', async () => {
    const err = new Error('transient');
    await expect(
      service.process('t', 'k', null, async () => {
        throw err;
      })
    ).rejects.toBe(err);
    expect(producer.emit).not.toHaveBeenCalled();
  });
});
