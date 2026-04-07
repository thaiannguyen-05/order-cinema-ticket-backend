export type SyncCinemaRawDto = {
  cinema_id: number;
  cinema_name?: string;
  address?: string;
  address2?: string;
  city?: string;
  country?: string;
  postcode?: string;
  phone?: string;
  logo_url?: string;
};

export type SyncCinemaDetailDto = {
  quantity: number;
  cinemas: SyncCinemaRawDto[];
};
