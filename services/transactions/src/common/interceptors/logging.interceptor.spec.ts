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
        originalUrl: '/transactions',
        body: {},
        query: {},
        params: {}
      }),
      getResponse: () => ({ statusCode: 201 })
    })
  });

  it('skips non-http', async () => {
    const ctx: any = { getType: () => 'rpc' };
    const next: any = { handle: () => of('x') };
    await expect(interceptor.intercept(ctx, next).toPromise()).resolves.toBe('x');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs request and response', async () => {
    const ctx: any = buildHttpContext();
    const next: any = { handle: () => of({ id: 't-1' }) };
    await interceptor.intercept(ctx, next).toPromise();
    expect(logSpy).toHaveBeenCalledWith('[transactions] --> Request', expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith('[transactions] <-- Response', expect.any(Object));
  });

  it('logs Error messages', async () => {
    const ctx: any = buildHttpContext();
    const next: any = { handle: () => throwError(() => new Error('bad')) };
    await expect(interceptor.intercept(ctx, next).toPromise()).rejects.toThrow('bad');
    expect(logSpy).toHaveBeenCalledWith(
      '[transactions] <-- Response (error)',
      expect.objectContaining({ error: 'bad' })
    );
  });

  it('logs non-Error values', async () => {
    const ctx: any = buildHttpContext();
    const next: any = { handle: () => throwError(() => 'raw') };
    await expect(interceptor.intercept(ctx, next).toPromise()).rejects.toBe('raw');
    expect(logSpy).toHaveBeenCalledWith(
      '[transactions] <-- Response (error)',
      expect.objectContaining({ error: 'raw' })
    );
  });
});
