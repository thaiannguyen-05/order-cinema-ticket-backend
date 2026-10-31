# Chính sách đổi / trả / hoàn vé

- Vé đã thanh toán (Order PAID) không hỗ trợ đổi suất chiếu trực tuyến. Vui lòng liên hệ quầy vé trước giờ chiếu 60 phút.
- Vé giữ chỗ (Order PENDING) hết hạn sau 15 phút nếu không thanh toán (`expiresAt`).
- Order FAILED / EXPIRED / CANCELLED sẽ nhả Ticket về AVAILABLE, không phát sinh hoàn tiền vì chưa thu tiền.
- SePay IPN là kênh duy nhất chuyển Order sang PAID / FAILED. Không đối soát thủ công qua AI.
