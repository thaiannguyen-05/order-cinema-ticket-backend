import { IsNotEmpty, IsUUID } from 'class-validator';

export class GetPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  id!: string;
}
