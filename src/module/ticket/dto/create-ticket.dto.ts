export type CreateTicketDto = {
  time: Date;
  code: string;
  price: number;
  filmOfCinemaId: string;
  seatId: string;
};
