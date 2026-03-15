import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { MomoService } from './momo.service';
import type { MomoIPNHandler } from './dto/momo-ipn.handler';
import type { CreateMomoPaymentDto } from './dto/create.momoPayment';
import { Public } from '../../../core/decorator/ispublic.decorator';

@Controller('momo')
export class MomoController {
  constructor(private readonly momoService: MomoService) {}

  @Public()
  @Post('momo_ipn')
  async handleMomoIPN(@Body() dto: MomoIPNHandler) {
    return this.momoService.momoIpnHandler(dto);
  }

  @Get('check_payment_status/:orderId')
  async checkPaymentStatus(@Param('orderId') orderId: string) {
    return this.momoService.checkMomoPaymentStatus(orderId);
  }

  @Public()
  @Post('create_payment')
  async createPayment(@Body() dto: CreateMomoPaymentDto) {
    return this.momoService.createMomoPayment(dto);
  }

  @Public()
  @Get('payment_result')
  @Header('Content-Type', 'text/html; charset=utf-8')
  paymentResult(
    @Query('resultCode') resultCode?: string,
    @Query('orderId') orderId?: string,
    @Query('message') message?: string,
    @Query('amount') amount?: string,
    @Query('requestId') requestId?: string,
    @Query('transId') transId?: string,
  ) {
    const isSuccess = resultCode === '0';
    const statusText = isSuccess
      ? 'Thanh toan thanh cong'
      : 'Thanh toan that bai';
    const escapeHtml = (value?: string) =>
      (value ?? 'N/A')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MoMo Payment Result</title>
  <style>
    :root {
      --ok: #0f766e;
      --fail: #b91c1c;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --line: #e2e8f0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%);
      color: var(--text);
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      padding: 20px;
    }
    .card {
      width: min(760px, 100%);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      overflow: hidden;
    }
    .head {
      padding: 22px 24px;
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      background: ${isSuccess ? 'var(--ok)' : 'var(--fail)'};
    }
    .body { padding: 20px 24px 24px; }
    .status {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 14px;
      color: ${isSuccess ? 'var(--ok)' : 'var(--fail)'};
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .table td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      font-size: 14px;
    }
    .table td:first-child {
      color: var(--muted);
      width: 180px;
    }
    .btn {
      margin-top: 18px;
      display: inline-block;
      padding: 10px 14px;
      border-radius: 10px;
      border: 1px solid var(--line);
      color: var(--text);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="card">
    <header class="head">MoMo Payment Result</header>
    <section class="body">
      <p class="status">${statusText}</p>
      <table class="table">
        <tr><td>Result code</td><td>${escapeHtml(resultCode)}</td></tr>
        <tr><td>Message</td><td>${escapeHtml(message)}</td></tr>
        <tr><td>Order ID</td><td>${escapeHtml(orderId)}</td></tr>
        <tr><td>Amount</td><td>${escapeHtml(amount)}</td></tr>
        <tr><td>Request ID</td><td>${escapeHtml(requestId)}</td></tr>
        <tr><td>Transaction ID</td><td>${escapeHtml(transId)}</td></tr>
      </table>
      <a class="btn" href="/">Back to homepage</a>
    </section>
  </main>
</body>
</html>`;
  }
}
