export const REDIS_KEY = {
  REGISTER_USER: (email: string) => `register_user:${email}`,
  FORGOT_PASSWORD: (email: string) => `forgot_password:${email}`,
};

export const REDIS_TTL = {
  SHORT_TTL: 5 * 60 * 60 * 1000, // 5 hours in ms
  LOCK_SERVICE: 10 * 60 * 1000, // 10 minutes in ms
};

export const REDIS_LOCK_CLIENT = 'REDIS_LOCK_CLIENT';

export const REDIS_LOCK_KEY = {
  CINEMA_NERBY: 'lock:cron:sync-data-cinema-nearby',
  CINEMA_DETAIL: 'lock:cron:sync-data-cinema-detail',
  CINEMA_SHOWTIME: 'lock:cron:sync-data-cinema-showtime',
  CINEMA_NOWSHOWING: 'lock:cron:sync-data-films-now-showing',
  CINEMA_FILM_DETAIL: 'lock:cron:sync-data-film-detail',
  CINEMA_FILM_COMINGSOON: 'lock:cron:sync-data-films-comingsoon',
  REMOVE_OUTBOX_EXP: 'remove:outbox-exp',
  SEPAY_CHECKOUT: (invoiceNo: string) => `lock:sepay-checkout:${invoiceNo}`,
};
