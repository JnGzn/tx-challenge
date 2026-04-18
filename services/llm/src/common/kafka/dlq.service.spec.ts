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

  it('tagging helpers work as expected', () => {
    const tagged = asUnrecoverable(new Error('x'));
    expect(isUnrecoverable(tagged)).toBe(true);
    expect(isUnrecoverable(new Error('plain'))).toBe(false);
    expect(isUnrecoverable(null)).toBe(false);
    expect(isUnrecoverable('str')).toBe(false);
  });

  it('returns handler result when no error', async () => {
    await expect(service.process('t', 'k', {}, async () => 1)).resolves.toBe(1);
    expect(producer.emit).not.toHaveBeenCalled();
  });

  it('routes unrecoverable errors to DLQ topic', async () => {
    await service.process('t', 'k', { a: 1 }, async () => {
      throw asUnrecoverable(new Error('fatal'));
    });
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
