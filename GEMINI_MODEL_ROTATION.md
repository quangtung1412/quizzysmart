# Gemini Model Rotation System

## 📋 Tổng quan

Hệ thống xoay vòng model Gemini được thiết kế để tối ưu hóa việc sử dụng free quota của Google Gemini API cho nhiều người dùng đồng thời. Thay vì chỉ sử dụng một model và nhanh chóng đạt giới hạn, hệ thống tự động chuyển đổi giữa các model khác nhau dựa trên:

- **Priority** (Ưu tiên): Model có priority thấp hơn được ưu tiên sử dụng trước
- **RPM (Requests Per Minute)**: Giới hạn số request trong 1 phút
- **RPD (Requests Per Day)**: Giới hạn tổng số request trong 1 ngày

## 🎯 Cách hoạt động

### 1. Danh sách Models và Cấu hình

Hệ thống quản lý 10 models Gemini với thông tin chi tiết:

| Model Name | RPM | TPM | RPD | Priority |
|-----------|-----|-----|-----|----------|
| gemini-2.5-flash | 10 | 250,000 | 250 | **1** (Cao nhất) |
| gemini-2.0-flash | 15 | 1,000,000 | 200 | **2** |
| gemini-2.0-flash-lite | 30 | 1,000,000 | 200 | **3** |
| gemini-2.5-flash-lite | 15 | 250,000 | 1,000 | **4** |
| gemini-2.0-flash-exp | 10 | 250,000 | 50 | **5** |
| gemini-2.5-pro | 2 | 125,000 | 50 | **6** |
| gemma-3-12b | 30 | 15,000 | 14,400 | 7 |
| gemma-3-27b | 30 | 15,000 | 14,400 | 8 |
| gemma-3-4b | 30 | 15,000 | 14,400 | 9 |
| learnlm-2.0-flash-experimental | 15 | 0 | 1,500 | 10 |

### 2. Quy tắc chọn Model

1. **Ưu tiên theo Priority**: Hệ thống luôn cố gắng sử dụng model có priority **THẤP nhất** (số priority nhỏ nhất) trước
2. **Kiểm tra giới hạn RPM**: Nếu model đã đạt giới hạn requests trong phút hiện tại → chuyển sang model tiếp theo
3. **Kiểm tra giới hạn RPD**: Nếu model đã đạt giới hạn requests trong ngày → chuyển sang model tiếp theo
4. **Tự động reset**: 
   - RPM counter reset mỗi phút
   - RPD counter reset mỗi 24 giờ

### 3. Flow xử lý request

```
User Request → AI Search
    ↓
Check current model (lowest priority available)
    ↓
Model available? 
    ├── YES → Use model → Record usage
    └── NO → Find next available model (higher priority)
         ↓
         All models exhausted?
         ├── YES → Return error 503
         └── NO → Use found model → Record usage
```

## 🔧 Cài đặt và Cấu hình

### 1. File cấu hình

**Server**: `server/src/gemini-model-rotation.ts`
- Chứa logic xoay vòng models
- Quản lý rate limiting
- Tracking usage cho từng model

### 2. Integration

**Server API** (`server/src/index.ts`):
```typescript
// Import service
import { geminiModelRotation } from './gemini-model-rotation';

// Trong API endpoint /api/premium/search-by-image
const selectedModel = geminiModelRotation.getNextAvailableModel();
if (!selectedModel) {
  return res.status(503).json({ 
    error: 'Tất cả các model AI đã đạt giới hạn. Vui lòng thử lại sau.'
  });
}

// Sử dụng model
const model = genAI.getGenerativeModel({ model: selectedModel.name });
// ... xử lý AI request

// Ghi nhận request thành công
geminiModelRotation.recordRequest(selectedModel.name);
```

### 3. Admin Dashboard

Truy cập **Admin Panel** → **Gemini Model Stats** để xem:
- Danh sách tất cả models
- Usage hiện tại (RPM và RPD)
- Trạng thái available/exhausted
- Reset usage cho testing

## 📊 Monitoring

### API Endpoints

**1. Xem thống kê sử dụng (Admin only)**
```
GET /api/admin/model-usage
```

Response:
```json
{
  "stats": [
    {
      "name": "gemini-2.5-flash",
      "priority": 1,
      "rpm": "5/10",
      "rpd": "120/250",
      "rpmPercent": "50.0%",
      "rpdPercent": "48.0%",
      "available": true
    }
  ],
  "totalModels": 10,
  "availableModels": 8
}
```

**2. Reset usage (Admin only - for testing)**
```
POST /api/admin/reset-model-usage
Body: { "modelName": "gemini-2.5-flash" } // Optional, omit to reset all
```

### UI Dashboard

1. Đăng nhập với tài khoản Admin
2. Vào **Admin Panel**
3. Click tab **🤖 Gemini Model Stats**
4. Xem real-time stats với auto-refresh 10 giây

Dashboard hiển thị:
- ✅ Available models (màu xanh)
- ✗ Exhausted models (màu đỏ)
- Progress bars cho RPM và RPD
- Nút Reset từng model hoặc tất cả

## 🎨 UI Changes

### LiveCameraSearch Component

Khi AI search thành công, hiển thị thông tin model đã sử dụng:
```tsx
<div className="bg-blue-500/90 text-white px-3 py-1 rounded-full">
  AI Model: gemini-2.5-flash (P1)
</div>
```

## 🧪 Testing

### 1. Test basic rotation

```bash
# Gọi API nhiều lần để test rotation
curl -X POST http://localhost:3000/api/premium/search-by-image \
  -H "Content-Type: application/json" \
  -d '{"image":"base64...", "knowledgeBaseIds":["..."]}' \
  --cookie "connect.sid=..."
```

### 2. Xem logs

Server sẽ log ra console:
```
[ModelRotation] Using model: gemini-2.5-flash (priority 1)
[ModelRotation] gemini-2.5-flash - RPM: 1/10, RPD: 1/250
[ModelRotation] gemini-2.5-flash - RPM: 10/10, RPD: 10/250
[ModelRotation] gemini-2.5-flash limit reached, will switch to next available model
[ModelRotation] Next available model: gemini-2.0-flash (priority 2)
```

### 3. Reset usage via Admin UI

1. Vào Admin → Gemini Model Stats
2. Click **Reset** bên cạnh model cần reset
3. Hoặc click **Reset All** để reset tất cả

## 🚀 Lợi ích

1. **Tối ưu Free Quota**: Tận dụng tối đa free tier của nhiều models
2. **High Availability**: Tự động failover khi model hết quota
3. **Transparent**: User biết model nào đang được sử dụng
4. **Admin Monitoring**: Theo dõi real-time usage của tất cả models
5. **Smart Priority**: Ưu tiên models tốt nhất (flash models) trước

## ⚠️ Lưu ý

1. **API Key**: Đảm bảo `GEMINI_API_KEY` trong `.env` hợp lệ
2. **Rate Limits**: Giới hạn từ Google có thể thay đổi, cập nhật trong `gemini-model-rotation.ts`
3. **Memory**: Service lưu counters trong memory, restart server sẽ reset counters
4. **Production**: Có thể cần lưu counters vào database/Redis cho multi-instance deployments

## 🔗 Related Files

- `server/src/gemini-model-rotation.ts` - Core rotation logic
- `server/src/index.ts` - API integration
- `components/admin/ModelUsageStats.tsx` - Admin UI
- `components/LiveCameraSearch.tsx` - User-facing component
- `components/AdminDashboard.tsx` - Admin navigation

## 📞 Support

Nếu gặp vấn đề:
1. Check Admin Dashboard để xem model usage
2. Xem server logs để debug
3. Reset usage nếu cần test lại
4. Verify GEMINI_API_KEY hợp lệ
