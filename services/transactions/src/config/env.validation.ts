import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  @Min(1)
  @Max(65535)
  HTTP_PORT!: number;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  KAFKA_BROKERS!: string;

  @IsString()
  KAFKA_CLIENT_ID!: string;

  @IsString()
  KAFKA_GROUP_ID!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  TRANSACTIONS_LIST_LIMIT?: number;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }
  return validated;
}
