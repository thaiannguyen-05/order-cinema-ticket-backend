import { CinemaService } from '../../../../module/theater-module/cinema/cinema.service';

describe('CinemaService', () => {
  let service: CinemaService;
  let prismaService: {
    cinema: {
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      cinema: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
    };

    service = new CinemaService(prismaService as never);
  });

  it('creates cinema with optional fields', async () => {
    prismaService.cinema.create.mockResolvedValue({ cinema_id: 1 });

    await service.createCinema({
      cinema_id: 1,
      cinema_name: 'Cinema A',
      address: 'Addr',
      address2: 'Addr2',
      city: 'HCM',
      country: 'VN',
      postcode: '700000',
      phone: '0909',
      logo_url: 'logo',
    } as never);

    expect(prismaService.cinema.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cinema_id: 1,
          address2: 'Addr2',
          country: 'VN',
          phone: '0909',
        }),
      }),
    );
  });

  it('finds cinemas with cursor pagination', async () => {
    prismaService.cinema.findMany.mockResolvedValue([
      { cinema_id: 1 },
      { cinema_id: 2 },
      { cinema_id: 3 },
    ]);

    const result = await service.findCinemas({
      search: 'cgv',
      limit: 2,
      cursor: 1,
    } as never);

    expect(prismaService.cinema.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        skip: 1,
        cursor: { cinema_id: 1 },
      }),
    );
    expect(result).toEqual({
      cinemas: [{ cinema_id: 1 }, { cinema_id: 2 }],
      nextCursor: 3,
    });
  });

  it('finds cinemas with page pagination defaults', async () => {
    prismaService.cinema.findMany.mockResolvedValue([{ cinema_id: 10 }]);

    const result = await service.findCinemas({ search: 'cgv' } as never);

    expect(prismaService.cinema.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 11,
      }),
    );
    expect(result).toEqual({ cinemas: [{ cinema_id: 10 }], nextCursor: null });
  });

  it('upserts cinema', async () => {
    prismaService.cinema.upsert.mockResolvedValue({ cinema_id: 1 });

    await expect(
      service.upsertCinema({
        cinema_id: 1,
        cinema_name: 'Cinema A',
        address: 'Addr',
        city: 'HCM',
        postcode: '700000',
        logo_url: 'logo',
      } as never),
    ).resolves.toEqual({ cinema_id: 1 });
  });
});
