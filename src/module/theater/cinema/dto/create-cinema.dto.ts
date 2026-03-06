export type CreateCinemaDto = {
  cinema_id: number;
  cinema_name: string;
  address: string;
  address2?: string;
  city: string;
  country?: string;
  postcode: string;
  phone?: string;
  logo_url: string;
};
