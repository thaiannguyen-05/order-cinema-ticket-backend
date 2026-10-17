import { SeatController } from '../../../../module/theater-module/seat/seat.controller';
import { IS_PUBLIC_KEY } from '../../../../core/decorator/ispublic.decorator';

describe('SeatController', () => {
  let seatService: {
    createSeat: jest.Mock;
    getSeatsByRoomId: jest.Mock;
    getSeat: jest.Mock;
    updateSeat: jest.Mock;
    deleteSeat: jest.Mock;
    findSeats: jest.Mock;
  };
  let controller: SeatController;

  const UUID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    seatService = {
      createSeat: jest.fn(),
      getSeatsByRoomId: jest.fn(),
      getSeat: jest.fn(),
      updateSeat: jest.fn(),
      deleteSeat: jest.fn(),
      findSeats: jest.fn(),
    };

    controller = new SeatController(seatService as never);
  });

  it('delegates all seat endpoints', async () => {
    seatService.createSeat.mockResolvedValue({ id: 's1' });
    seatService.getSeatsByRoomId.mockResolvedValue([{ id: 's1' }]);
    seatService.getSeat.mockResolvedValue({ id: 's1' });
    seatService.updateSeat.mockResolvedValue({ id: 's1', row: 'B' });
    seatService.deleteSeat.mockResolvedValue({});
    seatService.findSeats.mockResolvedValue({ seats: [] });

    await expect(controller.createSeat({ row: 'A' } as never)).resolves.toEqual(
      {
        id: 's1',
      },
    );
    await expect(controller.getSeatsByRoomId(UUID)).resolves.toEqual([
      { id: 's1' },
    ]);
    await expect(controller.getSeat(UUID)).resolves.toEqual({ id: 's1' });
    await expect(
      controller.updateSeat(UUID, { row: 'B' } as never),
    ).resolves.toEqual({
      id: 's1',
      row: 'B',
    });
    await expect(controller.deleteSeat(UUID)).resolves.toEqual({});
    await expect(controller.findSeats({} as never)).resolves.toEqual({
      seats: [],
    });
  });

  it('marks only read endpoints as public', () => {
    const getSeatMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      SeatController.prototype.getSeat,
    );
    const getRoomMetadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      SeatController.prototype.getSeatsByRoomId,
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
    expect(getRoomMetadata).toBe(true);
    expect(findSeatsMetadata).toBe(true);
    expect(createSeatMetadata).toBeUndefined();
    expect(updateSeatMetadata).toBeUndefined();
    expect(deleteSeatMetadata).toBeUndefined();
  });
});
