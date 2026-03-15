export type CreateMomoPaymentDto = {
  amount: number;
  orderId: string;
  orderInfo: string;
  extraData?: string;
  lang?: 'vi' | 'en';
  userId: string;
  ticketId: string;
};
