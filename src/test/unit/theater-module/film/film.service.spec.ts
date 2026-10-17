import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { FindFilmsDto } from '../../../../module/theater-module/film/dto/find-films.dto';
import { FilmService } from '../../../../module/theater-module/film/film.service';

describe('FilmService', () => {
  let service: FilmService;
  let prismaService: {
    film: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  const UUID_1 = '11111111-1111-4111-8111-111111111111';
  const UUID_2 = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    prismaService = {
      film: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    service = new FilmService(prismaService as never);
  });

  it('creates film with direct DTO passthrough', async () => {
    prismaService.film.create.mockResolvedValue({ id: UUID_1 });

    const dto = {
      film_id: 1,
      imdb_id: 100,
      film_name: 'Film A',
      other_titles: JSON.stringify({ vi: 'Phim A' }),
      release_dates: [{ release_date: '2026-01-01' }],
      age_rating: [{ rating: 'P13' }],
      film_trailer: 'https://trailer',
      synopsis_long: 'desc',
      images: { poster: {}, still: {} },
    };

    await service.createFilm(dto as never);

    expect(prismaService.film.create).toHaveBeenCalledWith({
      data: dto,
    });
  });

  it('finds films with normal pagination', async () => {
    prismaService.film.count.mockResolvedValue(20);
    prismaService.film.findMany.mockResolvedValue([
      { id: UUID_1 },
      { id: UUID_2 },
    ]);

    const dto = plainToInstance(FindFilmsDto, {
      limit: 2,
      page: 2,
      search: 'film',
    });

    const result = await service.findFilms(dto);

    expect(prismaService.film.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        skip: 2,
      }),
    );
    expect(result).toEqual({
      films: [{ id: UUID_1 }, { id: UUID_2 }],
      total: 20,
      page: 2,
      limit: 2,
      totalPages: 10,
    });
  });

  it('finds films with DTO defaults', async () => {
    prismaService.film.count.mockResolvedValue(2);
    prismaService.film.findMany.mockResolvedValue([
      { id: UUID_1 },
      { id: UUID_2 },
    ]);

    // Simulates ValidationPipe(transform:true) in main.ts: defaults come from DTO
    const dto = plainToInstance(FindFilmsDto, { search: '' });
    expect(dto.limit).toBe(10);
    expect(dto.page).toBe(1);

    const result = await service.findFilms(dto);

    expect(prismaService.film.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 0,
      }),
    );
    expect(result).toEqual({
      films: [{ id: UUID_1 }, { id: UUID_2 }],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });
});
