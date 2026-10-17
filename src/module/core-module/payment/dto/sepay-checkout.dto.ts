import { IsNotEmpty, IsUUID } from 'class-validator';

export class SepayCheckoutDto {
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;
}
