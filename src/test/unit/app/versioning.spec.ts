import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { VERSION_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppController } from '../../../app.controller';
import { AppService } from '../../../app.service';

jest.mock('../../../module/core-module/auth/service/auth.service', () => ({
  AuthService: class AuthService {},
}));

jest.mock('../../../module/core-module/user/user.service', () => ({
  UserService: class UserService {},
}));

jest.mock('../../../module/core-module/payment/payment.service', () => ({
  PaymentService: class PaymentService {},
}));

jest.mock('../../../module/core-module/payment/sepay.service', () => ({
  SepayService: class SepayService {},
}));

jest.mock('../../../module/core-module/tracking/tracking.service', () => ({
  TrackingService: class TrackingService {},
}));

jest.mock('../../../module/theater-module/film/film.service', () => ({
  FilmService: class FilmService {},
}));

jest.mock('../../../module/theater-module/cinema/cinema.service', () => ({
  CinemaService: class CinemaService {},
}));

jest.mock('../../../module/theater-module/seat/seat.service', () => ({
  SeatService: class SeatService {},
}));

jest.mock('../../../module/theater-module/ticket/ticket.service', () => ({
  TicketService: class TicketService {},
}));

jest.mock(
  '../../../background/tracking-frequent-data/tracking-frequent-data.service',
  () => ({
    TrackingFrequentDataService: class TrackingFrequentDataService {},
  }),
);

type ControllerClass = new (...args: never[]) => object;

const { AuthController } =
  require('../../../module/core-module/auth/auth.controller') as {
    AuthController: ControllerClass;
  };
const { UserController } =
  require('../../../module/core-module/user/user.controller') as {
    UserController: ControllerClass;
  };
const { PaymentController } =
  require('../../../module/core-module/payment/payment.controller') as {
    PaymentController: ControllerClass & {
      prototype: { sepayCallback: (...args: never[]) => unknown };
    };
  };
const { TrackingController } =
  require('../../../module/core-module/tracking/tracking.controller') as {
    TrackingController: ControllerClass;
  };
const { FilmController } =
  require('../../../module/theater-module/film/film.controller') as {
    FilmController: ControllerClass;
  };
const { CinemaController } =
  require('../../../module/theater-module/cinema/cinema.controller') as {
    CinemaController: ControllerClass;
  };
const { SeatController } =
  require('../../../module/theater-module/seat/seat.controller') as {
    SeatController: ControllerClass;
  };
const { TicketController } =
  require('../../../module/theater-module/ticket/ticket.controller') as {
    TicketController: ControllerClass;
  };
const { TrackingFrequentDataController } =
  require('../../../background/tracking-frequent-data/tracking-frequent-data.controller') as {
    TrackingFrequentDataController: ControllerClass;
  };

const V1_CONTROLLERS: ControllerClass[] = [
  AuthController,
  UserController,
  PaymentController,
  TrackingController,
  FilmController,
  CinemaController,
  SeatController,
  TicketController,
  TrackingFrequentDataController,
];

describe('API versioning', () => {
  it.each(V1_CONTROLLERS.map((controller) => [controller.name]))(
    '%s is served under v1',
    (name) => {
      const target = V1_CONTROLLERS.find(
        (controller) => controller.name === name,
      );
      expect(Reflect.getMetadata(VERSION_METADATA, target)).toBe('1');
    },
  );

  it('serves health check without a version prefix', () => {
    expect(Reflect.getMetadata(VERSION_METADATA, AppController)).toBe(
      VERSION_NEUTRAL,
    );
  });

  it('keeps the SePay webhook without a version prefix', () => {
    const handler = (
      PaymentController as {
        prototype: { sepayCallback: (...args: never[]) => unknown };
      }
    ).prototype.sepayCallback;
    expect(Reflect.getMetadata(VERSION_METADATA, handler)).toBe(
      VERSION_NEUTRAL,
    );
  });

  it('routes /health unversioned and rejects /v1/health', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();

    await request(app.getHttpServer()).get('/health').expect(200, 'OK');
    await request(app.getHttpServer()).get('/v1/health').expect(404);

    await app.close();
  });
});
