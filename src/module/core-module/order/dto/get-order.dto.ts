import { IsNotEmpty, IsUUID } from 'class-validator';

export class GetOrderDto {
  @IsUUID()
  @IsNotEmpty()
  public orderId!: string;
}
