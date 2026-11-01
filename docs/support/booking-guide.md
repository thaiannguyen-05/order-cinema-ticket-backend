# Hướng dẫn đặt vé

1. Tìm phim qua tra cứu Film (tên phim).
2. Chọn Cinema và Suất chiếu (ShowTime) còn vé AVAILABLE.
3. Tạo Order cho 1 Ticket (quan hệ 1-1, `Order.ticketId`).
4. Thanh toán qua SePay checkout form. Chỉ SePay IPN mới xác nhận PAID.
5. Mang mã Order đến rạp trước giờ chiếu 30 phút.

Lưu ý: giá vé = `ShowTime.basedPrice` + chênh lệch `Ticket.price` theo loại ghế (NORMAL / COUPLE / HEAVEN).
