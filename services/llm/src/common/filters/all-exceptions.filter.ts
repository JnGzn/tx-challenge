import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

type ErrorBody = {
  error: string;
  message: string | string[];
};

const FIELD_LABELS: Record<string, string> = {
  transactionId: 'identificador de transacción'
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = randomUUID();
    const { statusCode, error, message } = this.normalize(exception);

    const body: ErrorBody = { error, message };

    this.logger.error(
      `[${correlationId}] ${request.method} ${request.url} → ${statusCode} ${error}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception)
    );

    response.status(statusCode).json(body);
  }

  private normalize(exception: unknown): { statusCode: number; error: string; message: string | string[] } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : (res as { message?: string | string[] }).message ?? exception.message;
      const error =
        typeof res === 'object' && (res as { error?: string }).error
          ? (res as { error: string }).error
          : HTTP_ERROR_NAMES[status] ?? 'Error';
      return { statusCode: status, error, message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaKnown(exception);
    }

    if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'El servicio no está disponible en este momento. Intenta de nuevo más tarde.'
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Ocurrió un error inesperado.'
    };
  }

  private fromPrismaKnown(e: Prisma.PrismaClientKnownRequestError): {
    statusCode: number;
    error: string;
    message: string;
  } {
    switch (e.code) {
      case 'P2002': {
        const field = extractFirstField(e.meta?.target);
        const label = field ? FIELD_LABELS[field] ?? field : 'valor';
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: `El ${label} ya se encuentra registrado.`
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'El recurso solicitado no existe.'
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'La referencia proporcionada no es válida.'
        };
      case 'P2000':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Alguno de los valores enviados excede la longitud permitida.'
        };
      case 'P2011':
      case 'P2012':
      case 'P2013':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Faltan datos obligatorios en la solicitud.'
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'Ocurrió un error procesando la solicitud.'
        };
    }
  }
}

const HTTP_ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
  503: 'Service Unavailable'
};

function extractFirstField(target: unknown): string | undefined {
  if (Array.isArray(target) && target.length > 0 && typeof target[0] === 'string') return target[0];
  if (typeof target === 'string') {
    const parts = target.split('_');
    return parts.length > 1 ? parts[parts.length - 2] : target;
  }
  return undefined;
}
