import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const { method, originalUrl, body, query, params } = request;
    const startedAt = Date.now();

    console.log('[transactions] --> Request', {
      method,
      url: originalUrl,
      params,
      query,
      body
    });

    return next.handle().pipe(
      tap({
        next: (payload) => {
          console.log('[transactions] <-- Response', {
            method,
            url: originalUrl,
            status: response.statusCode,
            durationMs: Date.now() - startedAt,
            body: payload
          });
        },
        error: (error) => {
          console.log('[transactions] <-- Response (error)', {
            method,
            url: originalUrl,
            status: response.statusCode,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : error
          });
        }
      })
    );
  }
}
