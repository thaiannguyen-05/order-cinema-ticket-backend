import { SeatController } from '../../../../module/theater-module/seat/seat.controller';
import { IS_PUBLIC_KEY } from '../../../../core/decorator/ispublic.decorator';

describe('SeatController', () => {
  let seatService: {
    createSeat: jest.Mock;
    getSeatsByShowtimeId: jest.Mock;
    getSeat: jest.Mock;
    updateSeat: jest.Mock;
    deleteSeat: jest.Mock;
    findSeats: jest.Mock;
  };
  let controller: SeatController;

  beforeEach(() => {
    seatService = {
      createSeat: jest.fn(),
      getSeatsByShowtimeId: jest.fn(),
      getSeat: jest.fn(),
      updateSeat: jest.fn(),
      deleteSeat: jest.fn(),
      findSeats: jest.fn(),
    };

    controller = new SeatController(seatService as never);
  });

  it('delegates all seat endpoints', async () => {
    seatService.createSeat.mockResolvedValue({ id: 's1' });
    seatService.getSeatsByShowtimeId.mockResolvedValue([{ id: 's1' }]);
    seatService.getSeat.mockResolvedValue({ id: 's1' });
    seatService.updateSeat.mockResolvedValue({ id: 's1', row: 2 });
    seatService.deleteSeat.mockResolvedValue({});
    seatService.findSeats.mockResolvedValue({ seats: [] });

    await expect(controller.createSeat({ row: 1 } as never)).resolves.toEqual({
      id: 's1',
    });
    await expect(controller.getSeatsByShowtimeId('film-1', 1)).resolves.toEqual(
      [{ id: 's1' }],
    );
    await expect(controller.getSeat('s1')).resolves.toEqual({ id: 's1' });
    await expect(
      controller.updateSeat('s1', { row: 2 } as never),
    ).resolves.toEqual({
      id: 's1',
      row: 2,
    });
    await expect(controller.deleteSeat('s1')).resolves.toEqual({});
    await expect(controller.findSeats({} as never)).resolves.toEqual({
      seats: [],
    });
  });

  it('marks only read endpoints as public', () => {
    const getSeatMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      SeatController.prototype.getSeat,
    );
    const getShowtimeMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      SeatController.prototype.getSeatsByShowtimeId,
    );
    const findSeatsMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      SeatController.prototype.findSeats,
    );
    const createSeatMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      SeatController.prototype.createSeat,
    );
    const updateSeatMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      SeatController.prototype.updateSeat,
    );
    const deleteSeatMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      SeatController.prototype.deleteSeat,
    );

    expect(getSeatMetadata).toBe(true);
    expect(getShowtimeMetadata).toBe(true);
    expect(findSeatsMetadata).toBe(true);
    expect(createSeatMetadata).toBeUndefined();
    expect(updateSeatMetadata).toBeUndefined();
    expect(deleteSeatMetadata).toBeUndefined();
  });
});
