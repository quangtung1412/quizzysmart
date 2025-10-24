# AI Search History - Lịch Sử Tìm Kiếm AI

## Tổng quan

Hệ thống tự động lưu lại toàn bộ lịch sử khi người dùng sử dụng tính năng **Tìm kiếm bằng AI** (Live Camera Search). 

Mỗi lần tìm kiếm, hệ thống ghi lại:
- ✅ Câu trả lời do AI trả về
- ✅ Model Gemini được sử dụng (10 models rotation)
- ✅ Token input/output (usage metadata)
- ✅ Thời gian xử lý (response time)
- ✅ User thực hiện tìm kiếm
- ✅ Độ tin cậy (confidence score)
- ✅ Trạng thái thành công/thất bại
- ✅ Thông báo lỗi (nếu có)

## Database Schema

```prisma
model AiSearchHistory {
  id                  Int       @id @default(autoincrement())
  userId              Int
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Input data (optional)
  imageBase64         String?   @db.Text
  knowledgeBaseIds    String    // JSON array of knowledge base IDs
  
  // AI Response
  recognizedText      String?   @db.Text
  extractedOptions    String?   @db.Text // JSON object {A, B, C, D}
  matchedQuestionId   Int?
  matchedQuestion     String?   @db.Text // Full JSON of matched question
  confidence          Int       @default(0) // 0-100
  
  // Model & Token info
  modelUsed           String
  modelPriority       Int       @default(0)
  inputTokens         Int       @default(0)
  outputTokens        Int       @default(0)
  totalTokens         Int       @default(0)
  
  // Metadata
  responseTime        Int       @default(0) // milliseconds
  success             Boolean   @default(true)
  errorMessage        String?   @db.Text
  createdAt           DateTime  @default(now())
  
  @@index([userId])
  @@index([createdAt])
  @@index([modelUsed])
}
```

## API Endpoint

### GET `/api/admin/ai-search-history`

**Authentication**: Admin only

**Query Parameters**:
- `page` (default: 1) - Trang hiện tại
- `limit` (default: 50) - Số kết quả mỗi trang
- `userId` (optional) - Lọc theo User ID
- `modelUsed` (optional) - Lọc theo model (vd: "gemini-2.0-flash-exp")
- `success` (optional) - Lọc theo trạng thái ("true" hoặc "false")
- `startDate` (optional) - Lọc từ ngày (ISO format)
- `endDate` (optional) - Lọc đến ngày (ISO format)

**Response**:
```json
{
  "history": [
    {
      "id": 1,
      "userId": 5,
      "user": {
        "id": 5,
        "username": "user123",
        "email": "user@example.com",
        "name": "Nguyễn Văn A"
      },
      "recognizedText": "Agribank được thành lập năm nào?",
      "confidence": 95,
      "modelUsed": "gemini-2.0-flash-exp",
      "modelPriority": 1,
      "inputTokens": 1234,
      "outputTokens": 456,
      "totalTokens": 1690,
      "responseTime": 2341,
      "success": true,
      "errorMessage": null,
      "createdAt": "2025-01-23T10:30:45.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  },
  "stats": {
    "byModel": {
      "gemini-2.0-flash-exp": {
        "total": 80,
        "success": 75,
        "failed": 5,
        "avgResponseTime": 2500,
        "totalInputTokens": 98760,
        "totalOutputTokens": 36520,
        "totalTokens": 135280
      }
    },
    "totalSearches": 150,
    "successRate": "95.33"
  }
}
```

## Admin Dashboard Component

Component: `components/admin/AiSearchHistory.tsx`

**Tính năng**:

### 1. Statistics Cards
- 📊 Tổng số tìm kiếm
- ✅ Tỷ lệ thành công (%)
- 🤖 Số model đã sử dụng

### 2. Model Statistics Table
Hiển thị thống kê chi tiết theo từng model:
- Tổng số requests
- Số lượng thành công/thất bại
- Tỷ lệ thành công (%)
- Thời gian phản hồi trung bình
- Tổng tokens đã sử dụng

### 3. Advanced Filters
- 🔍 User ID
- 🤖 Model name (dropdown)
- ✅ Status (All/Success/Failed)
- 📅 Date range (From - To)

### 4. Search History Table
Bảng chi tiết hiển thị:
- ID
- User (name + email)
- Model (+ priority)
- Câu hỏi nhận diện được
- Độ tin cậy (màu sắc: xanh ≥80%, vàng ≥50%, đỏ <50%)
- Tokens (total + breakdown input/output)
- Response time (ms)
- Status badge (Success/Failed)
- Timestamp

### 5. Pagination
- Navigation buttons (Previous/Next)
- Page info (current page / total pages)
- Total results count

## Cách sử dụng

### 1. Truy cập Admin Dashboard
```
Đăng nhập với tài khoản admin → Admin Panel → AI Search History (🔍)
```

### 2. Xem thống kê tổng quan
- Cards phía trên hiển thị metrics tổng quát
- Bảng "Thống Kê Theo Model" cho biết performance từng model

### 3. Lọc dữ liệu
```typescript
// Example: Tìm tất cả searches thất bại của user ID 5 trong tháng 1/2025
- User ID: 5
- Trạng thái: Thất bại
- Từ ngày: 2025-01-01
- Đến ngày: 2025-01-31
- Click "Áp dụng"
```

### 4. Phân tích lỗi
- Tìm searches có `success = false`
- Xem `errorMessage` trong bảng chi tiết
- Kiểm tra model nào hay bị lỗi

### 5. Giám sát token usage
- Theo dõi `totalTokens` theo từng model
- Optimize prompt để giảm token
- Identify models có average response time cao

## Auto-Logging

Hệ thống tự động log KHÔNG CẦN CẤU HÌNH THÊM:

### ✅ Success Case
```typescript
// File: server/src/index.ts (line ~2040)
await prisma.aiSearchHistory.create({
  data: {
    userId: user.id,
    knowledgeBaseIds: JSON.stringify(knowledgeBaseIds),
    recognizedText: recognizedText,
    extractedOptions: JSON.stringify({...}),
    matchedQuestionId: bestMatch?.id,
    matchedQuestion: JSON.stringify({...}),
    confidence: Math.round(bestScore * 100),
    modelUsed: selectedModel.name,
    modelPriority: selectedModel.priority,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    totalTokens: totalTokens,
    responseTime: responseTime,
    success: true
  }
});
```

### ❌ Error Case
```typescript
// File: server/src/index.ts (line ~2090)
catch (error) {
  // Save failed search to history
  await prisma.aiSearchHistory.create({
    data: {
      userId: user?.id || 0,
      knowledgeBaseIds: JSON.stringify(knowledgeBaseIds),
      modelUsed: selectedModel?.name || 'unknown',
      modelPriority: selectedModel?.priority || 0,
      responseTime: startTime > 0 ? Date.now() - startTime : 0,
      success: false,
      errorMessage: errorMessage
    }
  });
}
```

## Tích hợp với Model Rotation

History tracking hoạt động seamlessly với **Gemini Model Rotation System**:

1. Mỗi request, hệ thống chọn model tối ưu dựa trên:
   - Priority (1-10)
   - RPM/RPD limits
   - Current usage

2. Thông tin model được lưu vào history:
   - `modelUsed`: Tên model (vd: "gemini-2.0-flash-exp")
   - `modelPriority`: Priority level (1-10)

3. Admin có thể phân tích:
   - Model nào có tỷ lệ thành công cao nhất
   - Model nào xử lý nhanh nhất
   - Token consumption của từng model

## Performance Notes

### Database Indexes
```prisma
@@index([userId])      // Fast filter by user
@@index([createdAt])   // Fast date range queries
@@index([modelUsed])   // Fast model statistics
```

### Pagination
- Default: 50 records per page
- Recommended không load quá 100 records/page
- Use filters để narrow down results

### Token Tracking
- `inputTokens`: Prompt tokens (bao gồm image)
- `outputTokens`: Response tokens
- `totalTokens`: Tổng (hoặc từ API metadata)

## Troubleshooting

### Không thấy lịch sử mới
```bash
# Check server logs
cd server
npm run dev

# Look for:
[AI Search History] Saved search history for user: <userId>
```

### Lỗi khi filter
```typescript
// Make sure dates are in ISO format
startDate: "2025-01-01"  // ✅ Correct
startDate: "01/01/2025"  // ❌ Wrong
```

### Stats không chính xác
```bash
# Clear browser cache
# Refresh page
# Check console for API errors
```

## Future Enhancements

Có thể mở rộng:
- 📊 Export CSV/Excel
- 📈 Charts & graphs (success rate over time)
- 🔔 Alerts khi error rate cao
- 🎯 A/B testing models
- 💰 Cost calculation based on tokens
- 🗑️ Auto-cleanup old records (>90 days)

## Migration

Migration đã được apply:
```bash
Migration: 20251023155732_add_ai_search_history
Status: ✅ Applied
```

Không cần chạy migration thủ công, đã tự động chạy khi start server.
