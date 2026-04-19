import { FilmController } from '../../../../module/theater-module/film/film.controller';
import { IS_PUBLIC_KEY } from '../../../../core/decorator/ispublic.decorator';

describe('FilmController', () => {
  let filmService: {
    createFilm: jest.Mock;
    updateFilm: jest.Mock;
    deleteFilm: jest.Mock;
    getFilm: jest.Mock;
    findFilms: jest.Mock;
  };
  let controller: FilmController;

  beforeEach(() => {
    filmService = {
      createFilm: jest.fn(),
      updateFilm: jest.fn(),
      deleteFilm: jest.fn(),
      getFilm: jest.fn(),
      findFilms: jest.fn(),
    };

    controller = new FilmController(filmService as never);
  });

  it('delegates create/update/delete/get/find', async () => {
    filmService.createFilm.mockResolvedValue({ id: 1 });
    filmService.updateFilm.mockResolvedValue({ id: 1, film_name: 'new' });
    filmService.deleteFilm.mockResolvedValue({});
    filmService.getFilm.mockResolvedValue({ id: 1 });
    filmService.findFilms.mockResolvedValue({ films: [] });

    await expect(
      controller.createFilm({ film_id: 1 } as never),
    ).resolves.toEqual({ id: 1 });
    await expect(
      controller.updateFilm(1, { film_name: 'new' } as never),
    ).resolves.toEqual({
      id: 1,
      film_name: 'new',
    });
    await expect(controller.deleteFilm(1)).resolves.toEqual({});
    await expect(controller.getFilm(1)).resolves.toEqual({ id: 1 });
    await expect(
      controller.findFilms({ search: 'a' } as never),
    ).resolves.toEqual({ films: [] });
  });

  it('marks only read endpoints as public', () => {
    const getFilmMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      FilmController.prototype.getFilm,
    );
    const findFilmsMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      FilmController.prototype.findFilms,
    );
    const createFilmMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      FilmController.prototype.createFilm,
    );
    const updateFilmMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      FilmController.prototype.updateFilm,
    );
    const deleteFilmMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      FilmController.prototype.deleteFilm,
    );

    expect(getFilmMetadata).toBe(true);
    expect(findFilmsMetadata).toBe(true);
    expect(createFilmMetadata).toBeUndefined();
    expect(updateFilmMetadata).toBeUndefined();
    expect(deleteFilmMetadata).toBeUndefined();
  });
});
