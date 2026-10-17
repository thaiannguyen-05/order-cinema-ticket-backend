import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { FindSeatDto } from '../../../../module/theater-module/seat/dto/find-seat.dto';
import { SeatService } from '../../../../module/theater-module/seat/seat.service';
import { SeatStatus, SeatType } from '@prisma/client';

describe('SeatService', () => {
  let service: SeatService;
  let prismaService: {
    seat: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  const ROOM_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    prismaService = {
      seat: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new SeatService(prismaService as never);
  });

  it('creates seat with direct DTO passthrough', async () => {
    prismaService.seat.create.mockResolvedValue({ id: 's1' });

    const dto = {
      row: 'A',
      column: '12',
      seatType: SeatType.NORMAL,
      seatStatus: SeatStatus.AVAILABLE,
      roomId: ROOM_ID,
    };

    await expect(service.createSeat(dto as never)).resolves.toEqual({
      id: 's1',
    });

    const { roomId, ...rest } = dto;
    expect(prismaService.seat.create).toHaveBeenCalledWith({
      data: { ...rest, room: { connect: { id: roomId } } },
    });
  });

  it('updates seat with partial data', async () => {
    prismaService.seat.update.mockResolvedValue({ id: 's1' });

    await service.updateSeat('s1', { row: 'B' } as never);

    expect(prismaService.seat.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { row: 'B' },
    });
  });

  it('finds seats with normal pagination', async () => {
    prismaService.seat.count.mockResolvedValue(20);
    prismaService.seat.findMany.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);

    const dto = plainToInstance(FindSeatDto, {
      limit: 2,
      page: 2,
      roomId: ROOM_ID,
    });

    const result = await service.findSeats(dto);

    expect(prismaService.seat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roomId: ROOM_ID },
        take: 2,
        skip: 2,
      }),
    );
    expect(result).toEqual({
      seats: [{ id: 's1' }, { id: 's2' }],
      total: 20,
      page: 2,
      limit: 2,
      totalPages: 10,
    });
  });

  it('finds seats with DTO defaults', async () => {
    prismaService.seat.count.mockResolvedValue(1);
    prismaService.seat.findMany.mockResolvedValue([{ id: 's1' }]);

    const dto = plainToInstance(FindSeatDto, {});
    expect(dto.limit).toBe(10);
    expect(dto.page).toBe(1);

    const result = await service.findSeats(dto);

    expect(prismaService.seat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        skip: 0,
      }),
    );
    expect(result).toEqual({
      seats: [{ id: 's1' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('gets seats by room', async () => {
    prismaService.seat.findMany.mockResolvedValue([{ id: 's1' }]);

    await expect(service.getSeatsByRoomId(ROOM_ID)).resolves.toEqual([
      { id: 's1' },
    ]);
    expect(prismaService.seat.findMany).toHaveBeenCalledWith({
      where: { roomId: ROOM_ID },
      orderBy: { id: 'asc' },
    });
  });
});
