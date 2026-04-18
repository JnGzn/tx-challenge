import { IsEnum, IsNumber, IsOptional, IsUUID, Matches, Min, ValidateIf } from 'class-validator';
import { TransactionType } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ValidateIf((o: CreateTransactionDto) => o.type !== TransactionType.DEPOSIT)
  @IsUUID()
  @Matches(UUID_REGEX)
  sourceAccountId?: string;

  @ValidateIf((o: CreateTransactionDto) => o.type !== TransactionType.WITHDRAWAL)
  @IsUUID()
  @Matches(UUID_REGEX)
  targetAccountId?: string;

  @IsOptional()
  @IsUUID()
  @Matches(UUID_REGEX)
  idempotencyKey?: string;
}
