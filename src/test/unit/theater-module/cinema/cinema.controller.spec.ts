import { CinemaController } from '../../../../module/theater-module/cinema/cinema.controller';

describe('CinemaController', () => {
  let cinemaService: {
    getCinema: jest.Mock;
    createCinema: jest.Mock;
    updateCinema: jest.Mock;
    deleteCinema: jest.Mock;
    findCinemas: jest.Mock;
  };
  let controller: CinemaController;

  beforeEach(() => {
    cinemaService = {
      getCinema: jest.fn(),
      createCinema: jest.fn(),
      updateCinema: jest.fn(),
      deleteCinema: jest.fn(),
      findCinemas: jest.fn(),
    };

    controller = new CinemaController(cinemaService as never);
  });

  it('delegates all cinema endpoints', async () => {
    cinemaService.getCinema.mockResolvedValue({ cinema_id: 1 });
    cinemaService.createCinema.mockResolvedValue({ cinema_id: 1 });
    cinemaService.updateCinema.mockResolvedValue({
      cinema_id: 1,
      cinema_name: 'New',
    });
    cinemaService.deleteCinema.mockResolvedValue(undefined);
    cinemaService.findCinemas.mockResolvedValue({ cinemas: [] });

    await expect(controller.getCinema(1)).resolves.toEqual({ cinema_id: 1 });
    await expect(
      controller.createCinema({ cinema_id: 1 } as never),
    ).resolves.toEqual({
      cinema_id: 1,
    });
    await expect(
      controller.updateCinema({ cinema_name: 'New' } as never, 1),
    ).resolves.toEqual({
      cinema_id: 1,
      cinema_name: 'New',
    });
    await expect(controller.deleteCinema(1)).resolves.toBeUndefined();
    await expect(
      controller.findCinemas({ search: 'cgv' } as never),
    ).resolves.toEqual({
      cinemas: [],
    });
  });
});
