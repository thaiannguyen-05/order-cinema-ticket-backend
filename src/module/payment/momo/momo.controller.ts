import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MomoService } from './momo.service';
import type { MomoIPNHandler } from './dto/momo-ipn.handler';
import type { CreateMomoPaymentDto } from './dto/create.momoPayment';

@Controller('momo')
export class MomoController {
  constructor(private readonly momoService: MomoService) {}

  @Post('momo_ipn')
  async handleMomoIPN(@Body() dto: MomoIPNHandler) {
    return this.momoService.momoIpnHandler(dto);
  }

  @Get('check_payment_status')
  async checkPaymentStatus(@Param('orderId') orderId: string) {
    return this.momoService.checkMomoPaymentStatus(orderId);
  }

  @Post('create_payment')
  async createPayment(@Body() dto: CreateMomoPaymentDto) {
    return this.momoService.createMomoPayment(dto);
  }
}
