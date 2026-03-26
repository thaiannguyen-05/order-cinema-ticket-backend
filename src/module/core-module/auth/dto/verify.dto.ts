import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VreifyEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  code: string;
}
