import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TransactionStatus, TransactionType } from '@prisma/client';

export class QueryTransactionsDto {
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}
