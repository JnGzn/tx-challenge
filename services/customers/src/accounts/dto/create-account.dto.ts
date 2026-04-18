import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateAccountDto {
  @IsUUID()
  clientId!: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  initialBalance?: number;
}
