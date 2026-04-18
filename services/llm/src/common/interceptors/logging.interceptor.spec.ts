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
        method: 'GET',
        originalUrl: '/explanations',
        body: {},
        query: {},
        params: {}
      }),
      getResponse: () => ({ statusCode: 200 })
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
    const next: any = { handle: () => of({ ok: true }) };
    await interceptor.intercept(ctx, next).toPromise();
    expect(logSpy).toHaveBeenCalledWith('[llm] --> Request', expect.any(Object));
    expect(logSpy).toHaveBeenCalledWith('[llm] <-- Response', expect.any(Object));
  });

  it('logs Error messages', async () => {
    const ctx: any = buildHttpContext();
    const next: any = { handle: () => throwError(() => new Error('bad')) };
    await expect(interceptor.intercept(ctx, next).toPromise()).rejects.toThrow('bad');
    expect(logSpy).toHaveBeenCalledWith(
      '[llm] <-- Response (error)',
      expect.objectContaining({ error: 'bad' })
    );
  });

  it('logs non-Error values', async () => {
    const ctx: any = buildHttpContext();
    const next: any = { handle: () => throwError(() => 'raw') };
    await expect(interceptor.intercept(ctx, next).toPromise()).rejects.toBe('raw');
    expect(logSpy).toHaveBeenCalledWith(
      '[llm] <-- Response (error)',
      expect.objectContaining({ error: 'raw' })
    );
  });
});
