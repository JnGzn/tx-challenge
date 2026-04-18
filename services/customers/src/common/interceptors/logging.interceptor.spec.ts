import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  const buildHttpContext = () => ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        originalUrl: '/clients',
        body: { name: 'Ada' },
        query: {},
        params: {}
      }),
      getResponse: () => ({ statusCode: 201 })
    })
  });

  it('skips non-http contexts', async () => {
    const ctx: any = { getType: () => 'rpc' };
    const next: any = { handle: () => of('rpc-result') };

    const result$ = interceptor.intercept(ctx, next);
    await expect(result$.toPromise()).resolves.toBe('rpc-result');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs request and response for http', async () => {
    const ctx: any = buildHttpContext();
    const next: any = { handle: () => of({ id: 'c-1' }) };

    const result = await interceptor.intercept(ctx, next).toPromise();

    expect(result).toEqual({ id: 'c-1' });
    expect(logSpy).toHaveBeenCalledWith('[customers] --> Request', expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith('[customers] <-- Response', expect.any(Object));
  });

  it('logs error when downstream throws an Error', async () => {
    const ctx: any = buildHttpContext();
    const next: any = { handle: () => throwError(() => new Error('bad')) };

    await expect(interceptor.intercept(ctx, next).toPromise()).rejects.toThrow('bad');
    expect(logSpy).toHaveBeenCalledWith(
      '[customers] <-- Response (error)',
      expect.objectContaining({ error: 'bad' })
    );
  });

  it('logs error when downstream throws a non-Error', async () => {
    const ctx: any = buildHttpContext();
    const next: any = { handle: () => throwError(() => 'string-error') };

    await expect(interceptor.intercept(ctx, next).toPromise()).rejects.toBe('string-error');
    expect(logSpy).toHaveBeenCalledWith(
      '[customers] <-- Response (error)',
      expect.objectContaining({ error: 'string-error' })
    );
  });
});
