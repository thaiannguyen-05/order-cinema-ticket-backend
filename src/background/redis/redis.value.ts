export const REDIS_KEY = {
  REGISTER_USER: (email: string) => `register_user:${email}`,
};

export const REDIS_TTL = {
  REGISTER_TTL: 5 * 60 * 60,
};
