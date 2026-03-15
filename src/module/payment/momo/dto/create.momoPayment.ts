export type CreateMomoPaymentDto = {
  requestId: string;
  partnerCode: string;
  partnerName?: string;
  storeId?: string;
  amount: number;
  orderId: string;
  orderInfo: string;
  autoCapture?: boolean;
  redirectUrl: string;
  ipnUrl: string;
  requestType?: 'captureWallet';
  extraData?: string;
  lang?: 'vi' | 'en';
  signature: string;
  userId: string;
  ticketId: string;
};
