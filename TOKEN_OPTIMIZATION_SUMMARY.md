# Tối Ưu Token và Tính Năng Premium Chat - Implementation Summary

## ✅ Phase 1: Tối ưu cơ bản (Giảm 40-50% token)

### 1. Giảm số chunks retrieved
- **Trước**: topK = 30 chunks cho tất cả queries
- **Sau**: 
  - topK = 12 cho câu hỏi đơn giản
  - topK = 20 cho câu hỏi phức tạp (bao nhiêu, tổng hợp, etc.)

### 2. Tối ưu prompt template
- **Trước**: ~800 words với nhiều ví dụ chi tiết
- **Sau**: ~400 words, ngắn gọn, giữ lại ý chính
- Loại bỏ các hướng dẫn redundant và ví dụ dài dòng

## ✅ Phase 2: Intelligent Filtering (Giảm 50-60% token)

### 1. Smart chunk filtering
- **filterChunksByRelevance()**: Lọc chunks dựa trên score threshold
- **removeDuplicateContent()**: Loại bỏ nội dung trùng lặp (80% similarity)
- **Document balancing**: Tối đa 3 chunks per document để đảm bảo đa dạng

### 2. Content similarity detection
- **calculateContentSimilarity()**: So sánh word-based similarity
- Tự động merge hoặc loại bỏ chunks có nội dung giống nhau

## ✅ Cache System - Giảm đáng kể cost cho câu hỏi trùng lặp

### 1. Intelligent caching
```typescript
// ChatCacheService features:
- TTL: 24 giờ
- Max cache size: 1000 entries  
- Min confidence threshold: 70%
- Question normalization để tăng cache hit rate
```

### 2. Cache management
- **Auto cleanup**: Xóa entries hết hạn mỗi giờ
- **LRU eviction**: Xóa entries cũ khi cache đầy
- **Admin endpoints**: `/api/chat/cache/stats` và `/api/chat/cache/clear`

### 3. Không cache complex queries
- Câu hỏi có từ khóa "bao nhiêu", "tổng hợp" không được cache
- Đảm bảo accuracy cho analysis queries

## ✅ Deep Search Feature - Tìm hiểu sâu hơn

### 1. Enhanced search parameters
```typescript
// Deep search sử dụng:
- topK: 25 (vs 12-20 normal)
- minScore: 0.3 (vs 0.5 normal) 
- Không áp dụng aggressive filtering
```

## ✅ Premium Quota System - Unified with Camera Search

### 1. Single quota system
- **aiSearchQuota** được sử dụng cho cả camera search và chat
- Mỗi lần chat (bao gồm cache hit) sẽ trừ 1 quota
- Deep search cũng trừ 1 quota (không cần quota riêng)

### 2. Quota management
```typescript
// Chat thường và deep search đều sử dụng:
- aiSearchQuota: Unified quota cho tất cả AI features
- Subscription users: Unlimited (không trừ quota)  
- Free users: Limited quota, cần nâng cấp khi hết
```

### 3. Consistent behavior với camera search
- Cache hit vẫn trừ quota (giống camera search)
- Error handling và response format tương tự
- Premium upgrade flow được tối ưu

### 3. Deep search endpoint
```typescript
POST /api/chat/deep-search
{
  "originalQuestion": "string",
  "messageId": number
}
```

## ✅ Database Schema Updates

### 1. User model updates
```sql
-- Remove premiumQuota (using unified aiSearchQuota)
ALTER TABLE User DROP COLUMN premiumQuota;
```

### 2. ChatMessage model enhancements  
```sql
ALTER TABLE chat_messages ADD COLUMN isDeepSearch BOOLEAN DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN confidence REAL;
ALTER TABLE chat_messages ADD COLUMN cacheHit BOOLEAN DEFAULT false;
```

### 3. New indexes
```sql
CREATE INDEX idx_chat_messages_isDeepSearch ON chat_messages(isDeepSearch);
CREATE INDEX idx_chat_messages_confidence ON chat_messages(confidence);
```

## ✅ API Enhancements

### 1. Updated endpoints
- **GET /api/chat/stream**: Hỗ trợ cache check + metadata tracking
- **POST /api/chat/ask**: Tương tự với non-streaming
- **POST /api/chat/deep-search**: Tính năng mới cho premium users

### 2. Response metadata
```json
{
  "fromCache": boolean,
  "isDeepSearch": boolean,
  "quotaUsed": boolean,
  "remainingQuota": number,
  "confidence": number,
  "model": "gemini-xxx (cached/deep search)"
}
```

## 📊 Ước tính hiệu quả

| Metric | Trước | Sau | Improvement |
|--------|-------|-----|-------------|
| Avg tokens/query | 4000+ | 1500-2000 | ~50% |
| Cache hit rate | 0% | 15-25% | ~20% cost reduction |
| Response time | Normal | Faster (cache) | 50-90% faster for cached |
| User satisfaction | Normal | Higher (deep search option) | Improved UX |

## 🔄 Workflow cho Users

### 1. Normal query flow
```
User question → Check aiSearchQuota → [Insufficient: Return 402] → Cache check → [Hit: Return cached + deduct quota] → [Miss: Process normally + deduct quota]
```

### 2. Deep search flow  
```
User unsatisfied → Click "Tìm hiểu sâu hơn" → Check aiSearchQuota → Enhanced search → Deduct quota → Save as deep search
```

### 3. Quota management
```
Any chat request → Check subscription → [Active: Free] → [Not active: Check & deduct aiSearchQuota] → Track usage
```

## 🎯 Next Steps

1. **Monitor performance**: Track actual token usage reduction
2. **A/B test cache TTL**: Tối ưu thời gian cache để balance freshness vs hit rate  
3. **Improve similarity detection**: Có thể dùng embedding similarity thay vì word-based
4. **Add more admin controls**: Cache invalidation patterns, quota management
5. **Frontend integration**: Implement UI cho deep search button và quota display

## 📈 Expected Business Impact

- **Cost reduction**: 50%+ giảm token cost
- **Performance improvement**: 2-5x faster response cho cached queries  
- **Premium conversion**: Deep search feature tạo value proposition cho subscription
- **User retention**: Better experience với smart caching và comprehensive answers