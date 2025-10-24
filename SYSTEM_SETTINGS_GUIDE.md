# Hướng dẫn sử dụng Dashboard Cài đặt Hệ thống

## Tổng quan

Dashboard mới cho phép admin quản lý hai tính năng quan trọng của hệ thống:

1. **Quay vòng Model AI** - Tự động chuyển đổi giữa các model Gemini để tối ưu quota miễn phí
2. **Giờ cao điểm** - Khóa tính năng Premium cho người dùng thường trong giờ cao điểm

## Các tính năng đã triển khai

### 1. Quay vòng Model AI

#### Chức năng
- **Bật/Tắt quay vòng**: Admin có thể chọn sử dụng hoặc không sử dụng tính năng quay vòng model
- **Model mặc định**: Khi tắt quay vòng, hệ thống sẽ sử dụng model được chọn (mặc định: gemini-2.5-flash)
- **Tự động**: Khi bật, hệ thống tự động chọn model dựa trên quota còn lại

#### Hoạt động
- **Khi quay vòng BẬT**: 
  - Hệ thống tự động chuyển đổi giữa các model theo thứ tự ưu tiên
  - Theo dõi và ghi nhận số lượng request của mỗi model
  - Tránh vượt quá giới hạn RPM (Requests Per Minute) và RPD (Requests Per Day)

- **Khi quay vòng TẮT**:
  - Sử dụng model mặc định được chỉ định
  - KHÔNG ghi nhận vào hệ thống rotation
  - Vẫn giữ nguyên logic tìm kiếm và tính toán token

#### Các model có sẵn
- gemini-2.5-flash (mặc định)
- gemini-2.0-flash
- gemini-2.0-flash-lite
- gemini-2.5-flash-lite
- gemini-2.0-flash-exp
- gemini-2.5-pro

### 2. Giờ cao điểm

#### Chức năng
- **Bật/Tắt giờ cao điểm**: Kích hoạt/vô hiệu hóa chế độ giờ cao điểm
- **Cấu hình thời gian**: 
  - Giờ bắt đầu (HH:MM)
  - Giờ kết thúc (HH:MM)
  - Các ngày trong tuần áp dụng (Chủ nhật - Thứ 7)

#### Hoạt động
- **Trong giờ cao điểm**:
  - Tính năng **AI Trợ lý** bị khóa cho người dùng thường
  - Tính năng **Tra cứu** bị khóa cho người dùng thường
  - Hiển thị badge "🔒 GIỜ CAO ĐIỂM" màu đỏ
  - Card tính năng chuyển sang màu xám (disabled state)
  - Khi click vào, hiển thị thông báo yêu cầu nâng cấp

- **Người dùng Premium**:
  - Admin: Không bị giới hạn
  - Premium/Plus users: Vẫn sử dụng đầy đủ tính năng

#### Giao diện người dùng
Khi trong giờ cao điểm, người dùng thường sẽ thấy:
- Card "AI Trợ lý" và "Tra cứu" có màu xám
- Badge "🔒 GIỜ CAO ĐIỂM" hiển thị góc trên bên trái
- Opacity giảm xuống 60%
- Con trỏ chuột hiển thị "not-allowed"
- Khi click: Popup xác nhận nâng cấp lên Premium

## Cách sử dụng

### Truy cập Dashboard Cài đặt Hệ thống

1. Đăng nhập với tài khoản Admin
2. Vào **Admin Panel** từ menu chính
3. Click vào **"Cài đặt hệ thống"** (biểu tượng ⚙️) trong sidebar

### Cấu hình Quay vòng Model

1. Trong phần **"Quay vòng Model AI"**:
   - Bật/Tắt toggle switch "Bật quay vòng model"
   - Nếu TẮT: Chọn model mặc định từ dropdown

2. Click **"Lưu cài đặt"** để áp dụng

### Cấu hình Giờ cao điểm

1. Trong phần **"Giờ cao điểm"**:
   - Bật/Tắt toggle switch "Bật giờ cao điểm"
   
2. Nếu BẬT, cấu hình:
   - **Giờ bắt đầu**: Chọn thời gian (VD: 18:00)
   - **Giờ kết thúc**: Chọn thời gian (VD: 22:00)
   - **Ngày áp dụng**: Click vào các ngày muốn áp dụng
     - Màu xanh = Đã chọn
     - Màu trắng = Chưa chọn

3. Xem preview cài đặt hiện tại trong box màu vàng

4. Click **"Lưu cài đặt"** để áp dụng

## Kiến trúc kỹ thuật

### Database Schema

```prisma
model SystemSettings {
  id                    String   @id @default(cuid())
  modelRotationEnabled  Boolean  @default(true)
  defaultModel          String   @default("gemini-2.5-flash")
  peakHoursEnabled      Boolean  @default(false)
  peakHoursStart        String?
  peakHoursEnd          String?
  peakHoursDays         String   @default("[]")
  updatedAt             DateTime @updatedAt
  updatedBy             String?
}
```

### API Endpoints

#### Admin Endpoints (Yêu cầu quyền Admin)

- `GET /api/admin/system-settings`
  - Lấy cài đặt hệ thống hiện tại
  - Tự động tạo cài đặt mặc định nếu chưa có

- `PUT /api/admin/system-settings`
  - Cập nhật cài đặt hệ thống
  - Body: `{ modelRotationEnabled, defaultModel, peakHoursEnabled, peakHoursStart, peakHoursEnd, peakHoursDays }`

#### Public Endpoints

- `GET /api/peak-hours-status`
  - Kiểm tra trạng thái giờ cao điểm hiện tại
  - Response: `{ isPeakHours, enabled, peakHoursStart, peakHoursEnd, peakHoursDays }`

### Components

#### Backend
- `server/prisma/schema.prisma` - Database schema
- `server/src/index.ts` - API endpoints và model selection logic
- `server/src/gemini-model-rotation.ts` - Model rotation service (giữ nguyên)

#### Frontend
- `components/admin/SystemSettings.tsx` - Admin UI component
- `components/AdminDashboard.tsx` - Admin navigation
- `components/ModeSelectionScreen.tsx` - User UI với peak hours check
- `src/api.ts` - API client functions

## Luồng hoạt động

### Model Rotation Flow

```
User makes AI search request
  ↓
Check SystemSettings
  ↓
If modelRotationEnabled = true (FREE TIER MODE):
  → Use geminiModelRotation.getNextAvailableModel()
  → Select from 10 free models based on RPM/RPD availability
  → Record usage in rotation service (track quotas)
  → Log: "Model rotation ENABLED - Using free tier"
  
Else if modelRotationEnabled = false (PAID TIER MODE):
  → Use defaultModel from settings (assumed to be upgraded/paid)
  → Skip recording in rotation service (no quota tracking)
  → Assume high limits (1000+ RPM for paid tier)
  → Log: "Model rotation DISABLED - Using paid/upgraded model"
  ↓
Process search with selected model
  ↓
Calculate and store tokens (always tracked regardless of mode)
```

**💡 Key Insight:**
- **Rotation ON** = Using FREE tier models → Must track RPM/RPD quotas → Auto-switch when limits reached
- **Rotation OFF** = Using PAID tier model → No quota tracking needed → Assumes upgraded limits (e.g., 1000+ RPM)

### Peak Hours Flow

```
User opens ModeSelectionScreen
  ↓
Frontend calls /api/peak-hours-status
  ↓
Backend checks:
  - peakHoursEnabled
  - Current day in peakHoursDays
  - Current time between start/end
  ↓
Return isPeakHours status
  ↓
Frontend updates UI:
  - If isPeakHours && !isPremiumUser:
    → Gray out AI Assistant & Quick Search
    → Show "🔒 GIỜ CAO ĐIỂM" badge
    → Block click action
    → Show upgrade prompt on click
```

## Lưu ý quan trọng

1. **Chỉ có 1 record SystemSettings**: Hệ thống chỉ sử dụng record đầu tiên, tự động tạo nếu chưa có

2. **Peak hours check mỗi phút**: Frontend kiểm tra trạng thái giờ cao điểm mỗi 60 giây

3. **Admin bypass**: Admin luôn có quyền truy cập đầy đủ mọi tính năng

4. **Token calculation**: Vẫn được tính toán và lưu trữ chính xác bất kể model rotation có bật hay không

5. **Migration đã chạy**: Database đã được cập nhật với bảng `system_settings`

6. **⚠️ Model Rotation Logic - QUAN TRỌNG**:
   - **Khi BẬT rotation** (`modelRotationEnabled = true`):
     - Sử dụng FREE tier models (10 models)
     - HỆ THỐNG SẼ tracking RPM/RPD quotas
     - Tự động chuyển model khi đạt giới hạn
     - Phù hợp khi chưa nâng cấp API key
   
   - **Khi TẮT rotation** (`modelRotationEnabled = false`):
     - Sử dụng 1 model cố định (defaultModel)
     - HỆ THỐNG KHÔNG tracking RPM/RPD (giả định đã paid)
     - Giá trị rpm: 999, rpd: 999 chỉ là dummy values
     - ⚡ **Admin phải đảm bảo model đã được nâng cấp lên Paid Tier**
     - Nếu không, sẽ nhanh chóng đạt giới hạn của Google và bị block

## Troubleshooting

### Model rotation không hoạt động
- Kiểm tra toggle "Bật quay vòng model" đã BẬT
- Xem logs server để kiểm tra model nào đang được sử dụng
- Kiểm tra trong Admin Panel → AI Model Stats

### Giờ cao điểm không áp dụng
- Kiểm tra toggle "Bật giờ cao điểm" đã BẬT
- Đảm bảo giờ hiện tại nằm trong khoảng start-end
- Kiểm tra ngày hiện tại có trong danh sách peakHoursDays
- Refresh trang để cập nhật trạng thái

### Người dùng Premium vẫn bị khóa
- Kiểm tra `user.subscriptionLevel` = 'PLUS' hoặc 'PREMIUM'
- Kiểm tra `user.role` = 'admin'
- Kiểm tra subscription chưa hết hạn

## Future Enhancements

Các tính năng có thể mở rộng:
- Thêm nhiều khung giờ cao điểm trong ngày
- Cấu hình giờ cao điểm khác nhau cho từng ngày
- Email/notification cho admin khi thay đổi settings
- Lịch sử thay đổi settings
- A/B testing cho model selection
- Analytics về usage trong/ngoài giờ cao điểm

## Changelog

### Version 1.0 (October 24, 2025)
- ✅ Thêm SystemSettings model vào database
- ✅ API endpoints cho quản lý settings
- ✅ Admin UI component cho cài đặt
- ✅ Model rotation configuration
- ✅ Peak hours configuration và enforcement
- ✅ UI updates cho peak hours restrictions
- ✅ Integration với AdminDashboard

---

Tài liệu được tạo ngày: 24/10/2025
