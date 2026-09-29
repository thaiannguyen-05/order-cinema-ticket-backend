export type IpApiResponse = {
  status: 'success' | 'fail';
  lat?: number;
  lon?: number;
  message?: string;
};

export type PublicIpResponse = {
  ip: string;
};
