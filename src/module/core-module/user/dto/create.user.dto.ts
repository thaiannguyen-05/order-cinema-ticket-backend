import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxDate,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ACCOUNT_STATUS } from '@prisma/client';

export class CreateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullname!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(255)
  hashedPassword!: string;

  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  @MaxDate(new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000), {
    message: 'user must be at least 13 years old',
  })
  dateOfBirth!: Date;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @IsOptional()
  @IsEnum(ACCOUNT_STATUS)
  status?: ACCOUNT_STATUS = 'PENDING';
}
