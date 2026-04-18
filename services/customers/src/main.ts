import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: config.getOrThrow<string>('KAFKA_CLIENT_ID'),
        brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(',').map((b) => b.trim())
      },
      consumer: {
        groupId: config.getOrThrow<string>('KAFKA_GROUP_ID'),
        allowAutoTopicCreation: true
      },
      producer: {
        allowAutoTopicCreation: true
      }
    }
  });

  await app.startAllMicroservices();

  const port = Number(config.getOrThrow<string>('HTTP_PORT'));
  await app.listen(port);

  Logger.log(`customers service listening on :${port}`, 'Bootstrap');
}

bootstrap();
