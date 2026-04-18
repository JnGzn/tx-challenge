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
        getRequest: () => ({ method: 'GET', url: '/x' })
      })
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it('maps HttpException (string response)', () => {
    const exc = new HttpException('boom', HttpStatus.FORBIDDEN);

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({ error: 'Forbidden', message: 'boom' });
  });

  it('maps HttpException (object response with message array)', () => {
    const exc = new BadRequestException({
      error: 'Bad Request',
      message: ['email must be an email']
    });

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: ['email must be an email']
    });
  });

  it('maps HttpException (object response without error field)', () => {
    const exc = new HttpException({ message: 'nope' }, HttpStatus.UNAUTHORIZED);

    filter.catch(exc, host);

    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized', message: 'nope' });
  });

  it('maps HttpException with unknown status code to "Error"', () => {
    const exc = new HttpException('weird', 418);

    filter.catch(exc, host);

    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith({ error: 'Error', message: 'weird' });
  });

  describe('Prisma known errors', () => {
    const build = (code: string, meta?: Record<string, unknown>) =>
      new Prisma.PrismaClientKnownRequestError('msg', {
        code,
        clientVersion: 'x',
        meta
      } as any);

    it('P2002 with array target', () => {
      filter.catch(build('P2002', { target: ['email'] }), host);
      expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(json).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'El email ya se encuentra registrado.'
      });
    });

    it('P2002 with string target containing suffix', () => {
      filter.catch(build('P2002', { target: 'Client_email_key' }), host);
      expect(json).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'El email ya se encuentra registrado.'
      });
    });

    it('P2002 with string target without underscores', () => {
      filter.catch(build('P2002', { target: 'email' }), host);
      expect(json).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'El email ya se encuentra registrado.'
      });
    });

    it('P2002 without meta falls back to "valor"', () => {
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

  it('Prisma validation error → 503', () => {
    const exc = new Prisma.PrismaClientValidationError('invalid', { clientVersion: 'x' } as any);
    filter.catch(exc, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('unknown error → 500', () => {
    filter.catch(new Error('ugh'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Ocurrió un error inesperado.'
    });
  });

  it('handles non-Error exceptions', () => {
    filter.catch({ something: 'weird' }, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
