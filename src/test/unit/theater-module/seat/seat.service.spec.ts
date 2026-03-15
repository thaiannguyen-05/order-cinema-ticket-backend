import { SeatService } from '../../../../module/theater-module/seat/seat.service';

describe('SeatService', () => {
  let service: SeatService;
  let prismaService: {
    seat: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaService = {
      seat: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new SeatService(prismaService as never);
  });

  it('creates seat', async () => {
    prismaService.seat.create.mockResolvedValue({ id: 's1' });

    await expect(
      service.createSeat({ row: 1, column: 2, filmId: 'f1', cinemaId: 1, status: 'AVAILABLE' } as never),
    ).resolves.toEqual({ id: 's1' });

    expect(prismaService.seat.create).toHaveBeenCalledWith({
      data: {
        row: 1,
        column: 2,
        filmId: 'f1',
        cinemaId: 1,
        status: 'AVAILABLE',
      },
    });
  });

  it('updates seat with partial data', async () => {
    prismaService.seat.update.mockResolvedValue({ id: 's1' });

    await service.updateSeat('s1', { row: 2, cinemaId: 2 } as never);

    expect(prismaService.seat.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { row: 2, cinemaId: 2 },
    });
  });

  it('finds seats by cursor pagination', async () => {
    prismaService.seat.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }, { id: 's3' }]);

    const result = await service.findSeats({ limit: 2, cursor: 's0', filmId: 'f1' } as never);

    expect(prismaService.seat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        skip: 1,
        cursor: { id: 's0' },
      }),
    );
    expect(result).toEqual({ seats: [{ id: 's1' }, { id: 's2' }], nextCursor: 's3' });
  });

  it('finds seats by page pagination defaults', async () => {
    prismaService.seat.findMany.mockResolvedValue([{ id: 's1' }]);

    const result = await service.findSeats({} as never);

    expect(prismaService.seat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 11,
        skip: 0,
      }),
    );
    expect(result).toEqual({ seats: [{ id: 's1' }], nextCursor: null });
  });

  it('gets seats by showtime', async () => {
    prismaService.seat.findMany.mockResolvedValue([{ id: 's1' }]);

    await expect(service.getSeatsByShowtimeId('film-1', 101)).resolves.toEqual([{ id: 's1' }]);
    expect(prismaService.seat.findMany).toHaveBeenCalledWith({
      where: { cinemaId: 101, filmId: 'film-1' },
    });
  });
});
