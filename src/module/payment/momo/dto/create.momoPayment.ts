export type CreateMomoPaymentDto = {
  amount: number;
  orderId: string;
  orderInfo: string;
  extraData?: string;
  lang?: 'vi' | 'en';
  ticketId: string;
};
