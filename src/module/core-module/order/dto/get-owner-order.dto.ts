import { IsNotEmpty, IsUUID } from 'class-validator';
import { GetOrderDto } from './get-order.dto';

export class GetOwnerOrderDto extends GetOrderDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;
}
