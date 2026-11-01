# Câu hỏi thường gặp (FAQ)

**Q: Tôi có thể xem suất chiếu của rạp nào?**
A: Hỏi AI theo tên rạp hoặc khu vực, ví dụ "suất chiếu rạp CGV Quận 1 ngày mai".

**Q: AI có đặt vé giúp tôi không?**
A: Không. AI chỉ tra cứu read-only (phim, rạp, suất, giá, trạng thái order của bạn). Đặt vé dùng API Order/Payment.

**Q: Vì sao order của tôi báo EXPIRED?**
A: Order PENDING quá 15 phút chưa thanh toán sẽ EXPIRED và nhả vé.

**Q: Ghế NOT_AVAILABLE là gì?**
A: Ghế bảo trì, không bán. `seatStatus` này khác trạng thái booking của Ticket.
