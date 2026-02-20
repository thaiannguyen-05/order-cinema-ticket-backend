export const REDIS_KEY = {
  REGISTER_USER: (email: string) => `register_user:${email}`,
  FOGOT_PASSWORD: (email: string) => `forgot_password:${email}`,
};

export const REDIS_TTL = {
  SHORT_TL: 5 * 60 * 60,
};
