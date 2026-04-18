import { IsEmail, MaxLength } from 'class-validator';

export class FindByEmailQueryDto {
  @IsEmail()
  @MaxLength(180)
  email!: string;
}
