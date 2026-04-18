import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync
} from 'class-validator';

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

  @IsString()
  @MinLength(10)
  GEMINI_API_KEY!: string;

  @IsOptional()
  @IsString()
  GEMINI_MODEL?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  LLM_TEMPERATURE?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  LLM_HISTORY_LIMIT?: number;
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
