# Gemini API Monitoring System

## Tổng quan

Hệ thống giám sát chi tiết các API calls đến Gemini AI, bao gồm:
- **Token usage** (input/output tokens)
- **Chi phí** tính theo $ dựa trên pricing của Google
- **Hiệu suất** (thời gian thực hiện)
- **Trạng thái** (success/error) và error tracking
- **Phân loại** theo model, request type, thời gian

## Kiến trúc

### 1. Database Schema (`GeminiApiCall` model)

```prisma
model GeminiApiCall {
  id                String   @id @default(cuid())
  
  // Request info
  endpoint          String   // 'generateContent', 'embedContent', etc.
  modelName         String   // 'gemini-2.5-flash', 'gemini-2.0-flash', etc.
  modelPriority     Int      // Priority from model rotation (0 = default)
  
  // User context
  userId            String?  // User who made the request (optional)
  requestType       String   // 'chat', 'search', 'embedding', 'document_extraction', 'query_preprocessing'
  
  // Token usage
  inputTokens       Int
  outputTokens      Int
  totalTokens       Int
  
  // Cost calculation (in USD)
  inputCost         Float    // Cost for input tokens
  outputCost        Float    // Cost for output tokens
  totalCost         Float    // Total cost
  
  // Performance metrics
  startTime         DateTime
  endTime           DateTime?
  duration          Int      // in milliseconds
  
  // Status
  status            String   // 'pending', 'success', 'error', 'retried'
  errorMessage      String?
  retryCount        Int
  
  // Additional metadata (JSON)
  metadata          String?
  
  @@index([userId, modelName, requestType, startTime, status])
}
```

### 2. Service Layer

**`gemini-tracker.service.ts`**
- **Tracking methods**:
  - `startTracking()`: Bắt đầu theo dõi một API call
  - `endTracking()`: Kết thúc và lưu kết quả
  - `trackCall()`: Theo dõi nhanh (one-shot)
  
- **Pricing calculation**: Tự động tính chi phí dựa trên:
  ```typescript
  const GEMINI_PRICING = {
    'gemini-2.5-flash': { inputPrice: 0.0375, outputPrice: 0.15 },
    'gemini-2.0-flash': { inputPrice: 0.0, outputPrice: 0.0 },  // FREE
    'gemini-2.5-pro': { inputPrice: 1.25, outputPrice: 5.00 },
    // ... more models
  }
  ```
  
- **Analytics methods**:
  - `getStats()`: Thống kê tổng hợp theo time range
  - `getCallLog()`: Lấy danh sách chi tiết với pagination
  - `getPricing()`: Lấy bảng giá hiện tại

### 3. Integration

Tracking được tích hợp vào tất cả các service gọi Gemini API:

**Ví dụ trong `gemini-rag.service.ts`:**
```typescript
const trackingId = await geminiTrackerService.startTracking({
  endpoint: 'generateContent',
  modelName: modelInfo.name,
  modelPriority: modelInfo.priority,
  requestType: 'chat',
  metadata: { question, chunkCount },
});

const response = await this.ai.models.generateContent({ ... });

await geminiTrackerService.endTracking(trackingId, {
  inputTokens,
  outputTokens,
  status: 'success',
});
```

Các service được tích hợp:
- ✅ `gemini-rag.service.ts`: Document extraction, embeddings, RAG answers
- ✅ `query-preprocessor.service.ts`: Query preprocessing
- ✅ `query-analyzer.service.ts`: Collection analysis

## API Endpoints

### Admin Routes (`/api/gemini/*`)

**1. GET `/api/gemini/summary`**
- Quick summary cho dashboard (today, this month, last 7 days)
- Response:
  ```json
  {
    "today": { "totalCalls": 150, "totalCost": 0.005, ... },
    "thisMonth": { "totalCalls": 5000, "totalCost": 0.152, ... },
    "last7Days": { "totalCalls": 1200, "totalCost": 0.038, ... }
  }
  ```

**2. GET `/api/gemini/stats?startDate&endDate&modelName&requestType&status`**
- Thống kê chi tiết với filters
- Response includes:
  - `summary`: Tổng hợp chung
  - `byModel`: Phân tích theo từng model
  - `byRequestType`: Phân tích theo loại request
  - `timeSeries`: Dữ liệu theo thời gian (cho charts)
  - `recentCalls`: 100 calls gần nhất

**3. GET `/api/gemini/calls?page&pageSize&filters`**
- Danh sách chi tiết các API calls với pagination
- Filters: `startDate`, `endDate`, `modelName`, `requestType`, `status`, `userId`

**4. GET `/api/gemini/models?days=7`**
- Usage statistics theo từng model
- Sorted by total cost (cao nhất trước)

**5. GET `/api/gemini/request-types?days=7`**
- Breakdown theo loại request
- Sorted by number of calls

**6. GET `/api/gemini/timeline?days=7`**
- Time series data cho charts
- Daily aggregation

**7. GET `/api/gemini/pricing`**
- Bảng giá hiện tại của tất cả models
- Giá tính theo 1M tokens (USD)

## Admin UI

### Màn hình `GeminiMonitoring.tsx`

**5 tabs chính:**

1. **📊 Tổng quan (Overview)**
   - 4 summary cards: Total Calls, Total Tokens, Total Cost, Avg Duration
   - Quick stats cho time range được chọn
   - Visual indicators: success rate, avg cost per call

2. **🤖 Models**
   - Table showing usage per model
   - Columns: Model name, Calls, Tokens, Cost, Avg Duration, Success Rate
   - Sorted by cost (highest first)
   - Color-coded success rates

3. **📋 Request Types**
   - Breakdown by request type
   - Types: `chat`, `search`, `embedding`, `document_extraction`, `query_preprocessing`
   - Useful để identify expensive operations

4. **📈 Timeline**
   - Daily statistics
   - Shows trend over time
   - Data: Calls, Tokens, Cost per day

5. **📞 Recent Calls**
   - Table of most recent API calls (up to 50)
   - Columns: Time, Model, Type, Duration, Tokens, Cost, Status
   - Click for details (future enhancement)

**Time Range Selector:**
- Hôm nay (Today)
- 7 ngày qua (Last 7 days)
- Tháng này (This month)

**Access:**
```
Admin Dashboard → Cài đặt hệ thống → Gemini API Monitor
```

## Pricing Information

Giá được cập nhật theo [Google AI Pricing](https://ai.google.dev/pricing):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| gemini-2.5-flash | $0.0375 | $0.15 |
| gemini-2.5-flash-lite | $0.00125 | $0.005 |
| gemini-2.5-pro | $1.25 | $5.00 |
| gemini-2.0-flash | FREE | FREE |
| gemini-2.0-flash-lite | FREE | FREE |
| gemini-1.5-flash | $0.075 | $0.30 |
| gemini-embedding-001 | FREE | - |

**Note:** FREE models vẫn có rate limits (RPM/RPD)

## Usage Examples

### Xem thống kê 7 ngày qua
```bash
curl -X GET "http://localhost:3000/api/gemini/stats?startDate=2024-11-12&endDate=2024-11-19" \
  -H "Cookie: connect.sid=..."
```

### Lọc theo model cụ thể
```bash
curl -X GET "http://localhost:3000/api/gemini/models?days=30" \
  -H "Cookie: connect.sid=..."
```

### Xem chi tiết 1 ngày
```bash
curl -X GET "http://localhost:3000/api/gemini/timeline?days=1" \
  -H "Cookie: connect.sid=..."
```

## Performance Considerations

1. **Indexes**: Database được index theo `userId`, `modelName`, `requestType`, `startTime`, `status` để query nhanh

2. **Batch Queries**: Service sử dụng batch queries để giảm DB calls

3. **Caching**: Frontend cache summary data trong 10s để tránh reload liên tục

4. **Pagination**: Call log sử dụng pagination (default 50 items/page)

5. **Async Tracking**: Tracking không block main flow - nếu fail chỉ log warning

## Monitoring Best Practices

### 1. Theo dõi chi phí hàng ngày
- Check "Hôm nay" tab mỗi buổi sáng
- Set alert nếu cost > threshold

### 2. Optimize expensive operations
- Xem "Request Types" tab
- Identify costly operations (document_extraction thường đắt nhất)
- Consider caching strategies

### 3. Model performance
- Compare cost vs quality cho các models
- Free models (2.0-flash) có thể dùng cho simple tasks
- Expensive models (2.5-pro) chỉ dùng khi cần chính xác cao

### 4. Error tracking
- Monitor failed calls
- Check errorMessage để identify issues
- Look for patterns (specific models/operations failing)

### 5. Rate limiting
- Cross-reference với Model Usage Stats
- Ensure rotation đang work properly
- Avoid hitting RPM/RPD limits

## Migration & Setup

### 1. Chạy Prisma migration
```bash
cd server
npx prisma migrate dev --name add-gemini-api-tracking
```

### 2. Restart server để load routes mới
```bash
cd server
npm run dev
```

### 3. Access UI
- Login as admin
- Go to: Admin Dashboard → Cài đặt hệ thống → Gemini API Monitor

## Troubleshooting

**Q: Không thấy data trong monitoring UI?**
- Check database có table `gemini_api_calls` chưa
- Verify tracking đang chạy (xem server logs)
- Đảm bảo đã có API calls sau khi migration

**Q: Cost calculation sai?**
- Verify model name matching với `GEMINI_PRICING` trong service
- Check token counts có chính xác không
- Xem pricing có update chưa

**Q: UI báo 403 Forbidden?**
- Đảm bảo user có `role = 'admin'`
- Check authentication token
- Verify routes được mount đúng

**Q: Performance slow khi có nhiều data?**
- Sử dụng filters để giới hạn time range
- Check database indexes
- Consider archiving old data (> 90 days)

## Future Enhancements

- [ ] Export to CSV/Excel
- [ ] Cost alerts & notifications
- [ ] Custom time range picker
- [ ] Comparison charts (week over week)
- [ ] User-level cost tracking
- [ ] Budget management
- [ ] Real-time dashboard (WebSocket)
- [ ] Cost optimization recommendations
- [ ] API call replay for debugging
- [ ] Integration with other monitoring tools

## Related Documentation

- [RAG_IMPLEMENTATION_SUMMARY.md](./RAG_IMPLEMENTATION_SUMMARY.md)
- [MODEL_ROTATION_SUMMARY.md](./MODEL_ROTATION_SUMMARY.md)
- [GEMINI_MODEL_ROTATION.md](./GEMINI_MODEL_ROTATION.md)
- [TOKEN_OPTIMIZATION_SUMMARY.md](./TOKEN_OPTIMIZATION_SUMMARY.md)
