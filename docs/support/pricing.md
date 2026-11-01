# Giá vé và loại ghế

- NORMAL: ghế thường, giá chuẩn theo `ShowTime.basedPrice`.
- COUPLE: ghế đôi, giá cao hơn ghế thường.
- HEAVEN: ghế cao cấp (nếu rạp có).
- Mỗi Ticket có `price` riêng cho 1 Seat + 1 ShowTime, trạng thái `AVAILABLE -> PROCESSING -> BOOKED`.

AI tra cứu giá qua `getTicketPrice(showTimeId)` và `searchCinemasShowtimes`. AI không tự tính giá ngoài dữ liệu.
