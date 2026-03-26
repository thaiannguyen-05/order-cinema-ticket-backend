export const REDIS_KEY = {
  REGISTER_USER: (email: string) => `register_user:${email}`,
  FORGOT_PASSWORD: (email: string) => `forgot_password:${email}`,
};

export const REDIS_TTL = {
  SHORT_TL: 5 * 60 * 60,
  LOCK_SERVICE: 10 * 60 * 1000,
};

export const REDIS_LOCK_CLIENT = 'REDIS_LOCK_CLIENT';

export const REDIS_LOCK_KEY = {
  CINEMA_NERBY: 'lock:cron:sync-data-cinema-nearby',
  CINEMA_DETAIL: 'lock:cron:sync-data-cinema-detail',
  CINEMA_SHOWTIME: 'lock:cron:sync-data-cinema-showtime',
  CINEMA_NOWSHOWING: 'lock:cron:sync-data-films-now-showing',
  CINEMA_FILM_DETAIL: 'lock:cron:sync-data-film-detail',
  ORDER_TICKET: (userId: string, seatId: string) =>
    `lock:order-ticket:${userId}:${seatId}`,
  MOMO_PAYMENT: (userId: string, ticketId: string) =>
    `lock:momo-payment:${userId}:${ticketId}`,
};
