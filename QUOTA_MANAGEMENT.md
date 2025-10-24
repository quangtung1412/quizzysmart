# Hệ Thống Quản Lý Quota AI Search

## 📋 Tổng Quan

Hệ thống phân quyền và quota cho tính năng **Premium AI Trợ Lý**:
- **User thường**: Mỗi user được cấp **10 lượt tìm kiếm AI** ban đầu
- **Admin**: **Không giới hạn** lượt tìm kiếm
- **Tính năng Tra cứu thông thường**: Chỉ hiển thị cho **Admin**

## 🎯 Các Tính Năng

### 1. Phân Quyền Tính Năng

#### Tra Cứu (Quick Search)
- ✅ **Admin**: Có quyền truy cập
- ❌ **User thường**: Không hiển thị trên menu

#### AI Trợ Lý (Premium)
- ✅ **Admin**: Không giới hạn lượt search
- ⚠️ **User thường**: Giới hạn theo quota

### 2. Quota System

#### Quota Mặc Định
```
User mới: 10 lượt tìm kiếm AI
Admin: Không giới hạn (∞)
```

#### Cách Hoạt Động
1. Mỗi lần tìm kiếm AI thành công → **Trừ 1 quota**
2. Header hiển thị: `Còn X lượt tìm kiếm`
3. Khi hết quota (0) → Không thể tìm kiếm, hiển thị thông báo

#### Thông Báo Khi Hết Quota
```
"Bạn đã hết lượt tìm kiếm AI. Vui lòng liên hệ admin để nạp thêm."
```

## 🔧 Quản Lý Quota (Admin)

### Script Nạp Quota

#### Cách 1: Sử dụng npm script
```bash
cd server
npm run add-quota
```

#### Cách 2: Chạy trực tiếp
```bash
cd server
npx tsx scripts/add-quota.ts
```

### Ví Dụ Sử Dụng
```bash
$ npm run add-quota
Nhập username hoặc email của user: user@example.com
Nhập số lượt tìm kiếm muốn thêm: 50
✅ Đã nạp quota thành công!
📧 User: user@example.com
🔢 Quota mới: 60 lượt
```

## 📊 Database Schema

### User Table
```prisma
model User {
  id            String    @id @default(cuid())
  username      String?   @unique
  email         String?   @unique
  role          String    @default("user") // 'admin' or 'user'
  aiSearchQuota Int       @default(10)     // Số lượt AI search còn lại
  // ... other fields
}
```

## 🔌 API Endpoints

### 1. Get User Info with Quota
```
GET /api/user/me
```

**Response:**
```json
{
  "id": "user_id",
  "username": "user123",
  "email": "user@example.com",
  "role": "user",
  "aiSearchQuota": 10
}
```

### 2. Search by Image (with Quota Check)
```
POST /api/premium/search-by-image
```

**Request:**
```json
{
  "image": "base64_image_string",
  "knowledgeBaseIds": ["kb1", "kb2"]
}
```

**Response (Success):**
```json
{
  "recognizedText": "Câu hỏi...",
  "matchedQuestion": { ... },
  "confidence": 95,
  "remainingQuota": 9  // Quota còn lại sau khi search
}
```

**Response (No Quota):**
```json
{
  "error": "Bạn đã hết lượt tìm kiếm AI. Vui lòng nạp thêm để tiếp tục sử dụng.",
  "quota": 0
}
```
HTTP Status: **403 Forbidden**

## 🎨 UI/UX Changes

### 1. ModeSelectionScreen
- **Tra cứu** chỉ hiển thị khi `isAdmin === true`
- **AI Trợ Lý** luôn hiển thị cho tất cả user

### 2. LiveCameraSearch Header
```tsx
{user?.role === 'admin' ? (
  'Không giới hạn lượt tìm kiếm'
) : (
  `Còn ${remainingQuota} lượt tìm kiếm`
)}
```

### 3. Thông Báo Lỗi
- **Hết quota**: "Bạn đã hết lượt tìm kiếm AI..."
- **Chưa đăng nhập**: "Vui lòng đăng nhập để sử dụng..."

## 🚀 Migration

### Tạo Migration
```bash
cd server
npx prisma migrate dev --name add_ai_search_quota
```

### Generate Prisma Client
```bash
cd server
npx prisma generate
```

## 📝 Lưu Ý Quan Trọng

1. **Quota chỉ trừ khi search thành công**
   - Nếu có lỗi → Không trừ quota
   - API trả về 500/400 → Quota không đổi

2. **Admin không bị giới hạn**
   - Không kiểm tra quota
   - Không trừ quota sau mỗi search
   - Hiển thị "Không giới hạn" thay vì số

3. **User mới tự động có 10 quota**
   - Default value trong database: `@default(10)`
   - Không cần setup thủ công

4. **Nạp quota là CỘNG THÊM, không SET**
   ```typescript
   aiSearchQuota: { increment: quota }  // Cộng thêm
   // NOT: aiSearchQuota: quota          // Set cứng
   ```

## 🔐 Bảo Mật

- Quota check ở cả **frontend** và **backend**
- Backend là nguồn tin cậy cuối cùng
- Frontend check để UX tốt hơn (không gọi API khi biết hết quota)

## 📞 Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra database: `aiSearchQuota` có giá trị âm?
2. Kiểm tra role: User có role đúng không?
3. Xem logs server khi call API
4. Verify Prisma client đã được generate: `npx prisma generate`
