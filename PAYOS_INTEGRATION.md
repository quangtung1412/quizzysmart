# Tích Hợp PayOS - Thanh Toán QR Code

## 📋 Tổng Quan

Hệ thống đã được tích hợp PayOS để tạo mã QR thanh toán tự động cho các gói Premium. Khi người dùng chọn gói, hệ thống sẽ:

1. Gọi PayOS API để tạo payment link
2. Nhận về QR code (base64) và thông tin tài khoản
3. Hiển thị QR code để người dùng quét và chuyển khoản
4. Tự động kích hoạt gói khi nhận được webhook từ PayOS

## 🚀 Cài Đặt

### 1. Đăng ký tài khoản PayOS

1. Truy cập [https://my.payos.vn](https://my.payos.vn)
2. Đăng ký và xác thực tài khoản (cá nhân hoặc doanh nghiệp)
3. Tạo kênh thanh toán mới

### 2. Lấy API Credentials

Từ dashboard PayOS, lấy 3 thông tin quan trọng:

- **Client ID**: ID của kênh thanh toán
- **API Key**: API Key từ kênh thanh toán
- **Checksum Key**: Key để tạo chữ ký (signature)

### 3. Cấu hình Environment Variables

Thêm vào file `server/.env`:

```env
# PayOS Configuration for Payment
PAYOS_CLIENT_ID=your_client_id_here
PAYOS_API_KEY=your_api_key_here
PAYOS_CHECKSUM_KEY=your_checksum_key_here
```

### 4. Cài đặt Dependencies

```bash
cd server
npm install
```

Lưu ý: Không cần cài package `@payos/node` vì chúng ta đã tự implement PayOS client trong `server/src/payos.ts`.

## 📡 API Endpoints

### 1. Tạo Payment Link

**POST** `/api/premium/create-payment-link`

**Request:**
```json
{
  "planId": "plus"  // hoặc "premium"
}
```

**Response:**
```json
{
  "success": true,
  "orderCode": 1729746123456,
  "amount": 50000,
  "description": "user123-PLUS-746123",
  "qrCode": "base64_string...",
  "checkoutUrl": "https://pay.payos.vn/...",
  "paymentLinkId": "abc123",
  "accountNumber": "1234567890",
  "accountName": "NGUYEN VAN A",
  "bin": "970415"
}
```

### 2. Kiểm tra trạng thái thanh toán

**GET** `/api/premium/payment-status/:orderCode`

**Response:**
```json
{
  "success": true,
  "status": "PAID",  // PENDING, PAID, CANCELLED
  "amount": 50000,
  "amountPaid": 50000,
  "transactions": [...]
}
```

### 3. Webhook nhận thông báo thanh toán

**POST** `/api/premium/payos-webhook`

PayOS sẽ gọi endpoint này khi có giao dịch thành công. Hệ thống sẽ:
- Xác thực chữ ký (signature)
- Tự động kích hoạt gói Premium cho user
- Gửi thông báo qua Telegram Bot

## 🔧 Cấu hình Webhook trên PayOS

1. Truy cập [https://my.payos.vn](https://my.payos.vn)
2. Vào kênh thanh toán → Cài đặt
3. Thêm Webhook URL:
   - Production: `https://yourdomain.com/api/premium/payos-webhook`
   - Development: Sử dụng ngrok hoặc công cụ tương tự để expose localhost

**Lưu ý:** PayOS sẽ gửi một request test để xác thực webhook. Đảm bảo server đang chạy.

## 💳 Gói Premium

### Gói Plus
- Giá: 50.000đ
- AI Quota: 100 lượt
- Thời hạn: 30 ngày

### Gói Premium
- Giá: 500.000đ
- AI Quota: 500 lượt
- Thời hạn: 365 ngày

## 🔐 Bảo Mật

### Signature Verification

PayOS sử dụng HMAC-SHA256 để tạo chữ ký:

1. **Tạo payment link:**
   - Data format: `amount={amount}&cancelUrl={cancelUrl}&description={description}&orderCode={orderCode}&returnUrl={returnUrl}`
   - Sort theo alphabet
   - HMAC-SHA256 với CHECKSUM_KEY

2. **Webhook verification:**
   - Xác thực signature từ webhook data
   - Reject request nếu signature không hợp lệ

### Transaction Code Format

Format: `{userId}-{PLAN}-{timestamp}`

Ví dụ: `abc12345-PLUS-746123`

Đây là nội dung chuyển khoản để PayOS và hệ thống có thể map giao dịch với user.

## 📱 Luồng Thanh Toán

### Frontend (PremiumPlansScreen.tsx)

1. User chọn gói Premium
2. Gọi API `createPaymentLink(planId)`
3. Hiển thị QR code từ PayOS
4. User quét QR và chuyển khoản
5. User bấm "Đã chuyển khoản"
6. Gọi API `checkPaymentStatus(orderCode)`
7. Hiển thị kết quả

### Backend Flow

1. Nhận request tạo payment link
2. Validate plan và user
3. Gọi PayOS API với signature
4. Trả về QR code và thông tin
5. Webhook nhận thông báo từ PayOS
6. Tự động kích hoạt Premium
7. Gửi thông báo Telegram

## 🧪 Testing

### Test với PayOS Sandbox

PayOS cung cấp môi trường test để thử nghiệm:

1. Sử dụng test credentials từ dashboard
2. Tạo payment link
3. PayOS cung cấp công cụ test để giả lập thanh toán thành công

### Test Webhook Locally

Sử dụng ngrok để expose localhost:

```bash
ngrok http 3000
```

Sau đó cấu hình webhook URL trên PayOS:
```
https://your-ngrok-id.ngrok.io/api/premium/payos-webhook
```

### Manual Test Webhook

Gửi POST request đến webhook endpoint:

```bash
curl -X POST http://localhost:3000/api/premium/payos-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "code": "00",
    "desc": "success",
    "success": true,
    "data": {
      "orderCode": 123456,
      "amount": 50000,
      "description": "user_id-PLUS-123456",
      "accountNumber": "1234567890",
      "reference": "FT123456",
      "transactionDateTime": "2025-10-23 18:25:00",
      "paymentLinkId": "abc123"
    },
    "signature": "your_signature_here"
  }'
```

## 🐛 Troubleshooting

### Lỗi "PayOS chưa được cấu hình"

- Kiểm tra file `.env` có đầy đủ 3 keys
- Đảm bảo không còn giá trị mặc định `your_*_here`
- Restart server sau khi update .env

### QR Code không hiển thị

- Kiểm tra response từ PayOS API
- Xem console log lỗi từ PayOS
- Đảm bảo credentials đúng và kênh thanh toán đang active

### Webhook không hoạt động

- Kiểm tra webhook URL đã cấu hình đúng
- Xem log server khi PayOS gửi request
- Verify signature calculation
- Đảm bảo server có thể nhận request từ bên ngoài (không bị firewall block)

### Không tự động kích hoạt gói

- Kiểm tra format của `description` field
- Xem log webhook để debug
- Kiểm tra user ID có tồn tại trong database
- Xem Telegram bot có nhận được notification không

## 📚 Tài Liệu PayOS

- API Documentation: https://payos.vn/docs/api/
- Dashboard: https://my.payos.vn
- Support: support@payos.vn

## 🔄 Migration từ hệ thống cũ

Hệ thống cũ sử dụng Telegram Bot để xác nhận thủ công. Giờ đây:

1. User vẫn có thể dùng cách cũ (chuyển khoản thủ công + admin kích hoạt)
2. Hoặc dùng PayOS (tự động 100%)
3. Cả 2 cách đều lưu vào bảng `Subscription`

## ✅ Checklist Triển Khai

- [ ] Đăng ký và xác thực tài khoản PayOS
- [ ] Tạo kênh thanh toán
- [ ] Lấy Client ID, API Key, Checksum Key
- [ ] Cập nhật file `.env` với credentials
- [ ] Cấu hình webhook URL trên PayOS dashboard
- [ ] Test tạo payment link
- [ ] Test quét QR và thanh toán
- [ ] Verify webhook nhận được và tự động kích hoạt
- [ ] Test trên production
- [ ] Cập nhật tài liệu cho user

## 💡 Tips

1. **Development**: Sử dụng ngrok để test webhook locally
2. **Production**: Đảm bảo HTTPS cho webhook endpoint
3. **Monitoring**: Theo dõi log của PayOS API calls
4. **Support**: Kiểm tra Telegram notifications để biết khi có thanh toán mới
5. **Backup**: Vẫn giữ phương thức thủ công cho trường hợp PayOS gặp sự cố

---

**Ngày cập nhật:** 23/10/2025
**Phiên bản:** 1.0.0
