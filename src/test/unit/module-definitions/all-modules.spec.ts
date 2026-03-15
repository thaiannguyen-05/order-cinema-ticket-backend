jest.mock('../../../core/logger/logger.service', () => ({
  MyLogger: class MyLogger {},
}));
jest.mock('@andev2005/movie-glu-sdk', () => ({
  createMovieGluClient: jest.fn(),
}));
jest.mock('@andev2005/momo-sdk', () => ({
  MomoClient: jest.fn(),
}));

const { AppModule } = require('../../../app.module') as { AppModule: unknown };
const { AuthModule } = require('../../../module/core-module/auth/auth.module') as {
  AuthModule: unknown;
};
const { UserModule } = require('../../../module/core-module/user/user.module') as {
  UserModule: unknown;
};
const { MomoModule } = require('../../../module/payment/momo/momo.module') as {
  MomoModule: unknown;
};
const { FilmModule } = require('../../../module/theater-module/film/film.module') as {
  FilmModule: unknown;
};
const { CinemaModule } = require('../../../module/theater-module/cinema/cinema.module') as {
  CinemaModule: unknown;
};
const { SeatModule } = require('../../../module/theater-module/seat/seat.module') as {
  SeatModule: unknown;
};
const { TicketModule } = require('../../../module/theater-module/ticket/ticket.module') as {
  TicketModule: unknown;
};
const { EmailModule } = require('../../../background/email/email.module') as {
  EmailModule: unknown;
};
const { RedisModule } = require('../../../background/redis/redis.module') as {
  RedisModule: unknown;
};
const { SyncDataCronJobModule } = require('../../../background/sync-data-cron-job/sync-data-cron-job.module') as {
  SyncDataCronJobModule: unknown;
};

describe('Module Definitions', () => {
  it('all module classes should be defined', () => {
    expect(AppModule).toBeDefined();
    expect(AuthModule).toBeDefined();
    expect(UserModule).toBeDefined();
    expect(MomoModule).toBeDefined();
    expect(FilmModule).toBeDefined();
    expect(CinemaModule).toBeDefined();
    expect(SeatModule).toBeDefined();
    expect(TicketModule).toBeDefined();
    expect(EmailModule).toBeDefined();
    expect(RedisModule).toBeDefined();
    expect(SyncDataCronJobModule).toBeDefined();
  });
});
