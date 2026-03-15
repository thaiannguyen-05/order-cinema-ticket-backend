export type MomoIPNHandler = {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
};

export type MomoIPNResponse = {
  partnerCode: string;
  requestId: string;
  orderId: string;
  resultCode: number;
  message: string;
  responseTime: number;
  extraData: string;
  signature: string;
};
