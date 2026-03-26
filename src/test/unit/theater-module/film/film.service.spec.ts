import { FilmService } from '../../../../module/theater-module/film/film.service';

describe('FilmService', () => {
  let service: FilmService;
  let prismaService: {
    film: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      film: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    service = new FilmService(prismaService as never);
  });

  it('creates film with serialized JSON fields', async () => {
    prismaService.film.create.mockResolvedValue({ film_id: 1 });

    await service.createFilm({
      film_id: 1,
      film_name: 'Film A',
      other_title: { vi: 'Phim A' },
      release_dates: [{ country: 'VN' }],
      age_rating: { code: 'P13' },
      trailers: [{ url: 'x' }],
      synopsis_long: 'desc',
      images: [{ url: 'img' }],
      version_type: '2D',
      duration_mins: 120,
      review_stars: 4.5,
      review_txt: 'good',
      distributor: 'dist',
      genres: [{ code: 'ACT' }],
      cast: [{ name: 'A' }],
      director: [{ name: 'D' }],
      producers: [{ name: 'P' }],
      writers: [{ name: 'W' }],
    } as never);

    expect(prismaService.film.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        film_id: 1,
        other_title: JSON.stringify({ vi: 'Phim A' }),
        release_dates: JSON.stringify([{ country: 'VN' }]),
      }),
    });
  });

  it('finds films by cursor pagination', async () => {
    prismaService.film.findMany.mockResolvedValue([
      { film_id: 1 },
      { film_id: 2 },
      { film_id: 3 },
    ]);

    const result = await service.findFilms({
      limit: 2,
      cursor: 1,
      search: 'film',
    } as never);

    expect(prismaService.film.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        skip: 1,
        cursor: { film_id: 1 },
      }),
    );
    expect(result).toEqual({
      films: [{ film_id: 1 }, { film_id: 2 }],
      nextCursor: 3,
    });
  });

  it('finds films by page pagination with defaults', async () => {
    prismaService.film.findMany.mockResolvedValue([
      { film_id: 11 },
      { film_id: 12 },
    ]);

    const result = await service.findFilms({ search: '' } as never);

    expect(prismaService.film.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 0,
      }),
    );
    expect(result).toEqual({
      films: [{ film_id: 11 }, { film_id: 12 }],
      nextCursor: null,
    });
  });
});
