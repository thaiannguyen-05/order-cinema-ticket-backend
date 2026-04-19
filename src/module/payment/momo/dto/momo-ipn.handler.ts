import { IsNumber, IsString } from 'class-validator';

export class MomoIPNHandler {
  @IsString()
  partnerCode: string;

  @IsString()
  orderId: string;

  @IsString()
  requestId: string;

  @IsNumber()
  amount: number;

  @IsString()
  orderInfo: string;

  @IsString()
  orderType: string;

  @IsNumber()
  transId: number;

  @IsNumber()
  resultCode: number;

  @IsString()
  message: string;

  @IsString()
  payType: string;

  @IsNumber()
  responseTime: number;

  @IsString()
  extraData: string;

  @IsString()
  signature: string;
}

export class MomoIPNResponse {
  @IsString()
  partnerCode: string;

  @IsString()
  requestId: string;

  @IsString()
  orderId: string;

  @IsNumber()
  resultCode: number;

  @IsString()
  message: string;

  @IsNumber()
  responseTime: number;

  @IsString()
  extraData: string;

  @IsString()
  signature: string;
}
