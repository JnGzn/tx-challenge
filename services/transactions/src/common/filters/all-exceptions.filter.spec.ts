import { BadRequestException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: any;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    filter = new AllExceptionsFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'POST', url: '/transactions' })
      })
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it('maps HttpException (string)', () => {
    filter.catch(new HttpException('boom', HttpStatus.FORBIDDEN), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({ error: 'Forbidden', message: 'boom' });
  });

  it('maps HttpException (object with message array)', () => {
    filter.catch(
      new BadRequestException({ error: 'Bad Request', message: ['fail'] }),
      host
    );
    expect(json).toHaveBeenCalledWith({ error: 'Bad Request', message: ['fail'] });
  });

  it('maps HttpException (object without error)', () => {
    filter.catch(
      new HttpException({ message: 'nope' }, HttpStatus.UNAUTHORIZED),
      host
    );
    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized', message: 'nope' });
  });

  it('maps HttpException with unknown status to "Error"', () => {
    filter.catch(new HttpException('weird', 418), host);
    expect(json).toHaveBeenCalledWith({ error: 'Error', message: 'weird' });
  });

  describe('Prisma known errors', () => {
    const build = (code: string, meta?: Record<string, unknown>) =>
      new Prisma.PrismaClientKnownRequestError('msg', {
        code,
        clientVersion: 'x',
        meta
      } as any);

    it('P2002 array target uses FIELD_LABELS', () => {
      filter.catch(build('P2002', { target: ['idempotencyKey'] }), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(json).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'El clave de idempotencia ya se encuentra registrado.'
      });
    });

    it('P2002 string target with underscore', () => {
      filter.catch(build('P2002', { target: 'Transaction_reference_key' }), host);
      expect(json).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'El referencia ya se encuentra registrado.'
      });
    });

    it('P2002 string target single token', () => {
      filter.catch(build('P2002', { target: 'reference' }), host);
      expect(json).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'El referencia ya se encuentra registrado.'
      });
    });

    it('P2002 without meta uses "valor"', () => {
      filter.catch(build('P2002'), host);
      expect(json).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'El valor ya se encuentra registrado.'
      });
    });

    it('P2002 with unknown field uses field name', () => {
      filter.catch(build('P2002', { target: ['foo'] }), host);
      expect(json).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'El foo ya se encuentra registrado.'
      });
    });

    it('P2025 → 404', () => {
      filter.catch(build('P2025'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    });

    it('P2003 → 400', () => {
      filter.catch(build('P2003'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('P2000 → 400', () => {
      filter.catch(build('P2000'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('P2011/P2012/P2013 → 400', () => {
      for (const code of ['P2011', 'P2012', 'P2013']) {
        filter.catch(build(code), host);
      }
      expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    });

    it('unknown Prisma code → 500', () => {
      filter.catch(build('P9999'), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  it('Prisma validation → 503', () => {
    filter.catch(
      new Prisma.PrismaClientValidationError('invalid', { clientVersion: 'x' } as any),
      host
    );
    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('unknown error → 500', () => {
    filter.catch(new Error('ugh'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('handles non-Error exceptions', () => {
    filter.catch({ weird: true }, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
