# Test Độ Chính Xác Qdrant Search

Script này giúp test và đánh giá độ chính xác của tính năng chat search sử dụng Qdrant vector database.

## 📋 Mô Tả

Script `test-qdrant-search.ts` thực hiện các chức năng sau:

1. **Kiểm tra kết nối**: Kết nối đến Qdrant và database
2. **Thống kê database**: Hiển thị số lượng documents và vectors
3. **Test cases đa dạng**: Chạy nhiều trường hợp test khác nhau
4. **Đánh giá kết quả**: Phân tích độ chính xác và relevance của kết quả

## 🚀 Cách Sử dụng

### 1. Chạy Test

```bash
cd server
npm run test:qdrant
```

Hoặc trực tiếp:

```bash
npx tsx test-qdrant-search.ts
```

### 2. Kết Quả

Script sẽ hiển thị:

- ✅ **Database Statistics**: Thống kê số lượng documents và vectors
- 🧪 **Test Cases**: Chạy 10 test cases với các query khác nhau
- 📊 **Search Results**: Kết quả tìm kiếm với score và preview
- 📈 **Statistics**: Thống kê avg score, max score, min score
- ✅ **Summary**: Tổng kết số test passed/failed

## 📝 Test Cases

Script bao gồm các test case sau:

1. **Câu hỏi chung**: "Quy định về tín dụng tiêu dùng là gì?"
2. **Câu hỏi cụ thể**: "Các điều kiện vay tín dụng tiêu dùng?"
3. **Từ khóa ngắn**: "Lãi suất cho vay tiêu dùng"
4. **Thủ tục**: "Thủ tục vay mua nhà ở xã hội"
5. **Thế chấp**: "Quy định về thế chấp tài sản"
6. **Hồ sơ**: "Hồ sơ cần thiết khi vay tín dụng"
7. **Nông nghiệp**: "Điều kiện cho vay nông nghiệp nông thôn"
8. **Số văn bản**: "Thông tư 01/2024 quy định gì?"
9. **Câu phức tạp**: "Ngân hàng nhà nước quy định như thế nào về cho vay?"
10. **Từ khóa đôi**: "Bảo lãnh tín dụng"

## 🔧 Tùy Chỉnh

### Thêm Test Cases

Mở file `test-qdrant-search.ts` và thêm vào array `testCases`:

```typescript
{
  query: 'Câu hỏi của bạn',
  description: 'Mô tả test case',
  minScore: 0.6  // Điểm tối thiểu mong đợi
}
```

### Điều Chỉnh Parameters

Trong code, bạn có thể thay đổi:

- **topK**: Số lượng kết quả trả về (default: 3, 5, 10)
- **minScore**: Ngưỡng điểm tối thiểu (default: 0.5-0.7)
- **Delay**: Thời gian chờ giữa các test (default: 2000ms)

## 📊 Đọc Kết Quả

### Score Interpretation

- **0.8 - 1.0**: Rất relevant ✅
- **0.7 - 0.8**: Relevant tốt ✅
- **0.6 - 0.7**: Có liên quan ⚠️
- **0.5 - 0.6**: Ít liên quan ⚠️
- **< 0.5**: Không liên quan ❌

### Ví dụ Output

```
TEST CASE 1: Test câu hỏi chung về tín dụng tiêu dùng
Query: "Quy định về tín dụng tiêu dùng là gì?"
Expected Min Score: 0.6
================================================================================

[1] Generating query embedding...
✓ Embedding generated (dimension: 768)

[2] Searching in Qdrant (Top-5)...
✓ Found 5 results

📊 Search Results (Top-5):
--------------------------------------------------------------------------------

1. SCORE: 0.8234 ✓
   Document: Thông tư 01/2024/TT-NHNN
   Chunk Type: article
   Article: 5
   Preview: Điều 5. Điều kiện vay tín dụng tiêu dùng...

📈 Statistics:
   Average Score: 0.7654
   Max Score: 0.8234
   Min Score: 0.6543
   Above Threshold: 5/5

✅ TEST PASSED - Found relevant results
```

## 🐛 Troubleshooting

### Không tìm thấy kết quả

1. Kiểm tra database có documents chưa
2. Kiểm tra Qdrant collection đã có vectors chưa
3. Thử giảm `minScore` xuống 0.3-0.4

### Lỗi kết nối Qdrant

1. Kiểm tra `.env` file có đúng config không:
   ```
   QDRANT_URL=your_qdrant_url
   QDRANT_API_KEY=your_api_key
   ```
2. Kiểm tra network/firewall

### Rate Limiting

- Script có tự động delay 2s giữa các tests
- Nếu vẫn bị rate limit, tăng delay lên 3-5s

## 📈 Cải Thiện Độ Chính Xác

Nếu kết quả không tốt, thử:

1. **Tăng số lượng chunks** khi upload documents
2. **Điều chỉnh chunk size** (nhỏ hơn = chính xác hơn nhưng nhiều chunks hơn)
3. **Improve embeddings** bằng cách thêm context vào chunks
4. **Fine-tune minScore** dựa trên kết quả test
5. **Thêm metadata filtering** để giới hạn phạm vi tìm kiếm

## 📚 Related Files

- `server/src/services/qdrant.service.ts` - Qdrant service
- `server/src/services/gemini-rag.service.ts` - RAG service
- `RAG_TESTING_GUIDE.md` - Hướng dẫn test RAG system
- `QDRANT_SETUP_GUIDE.md` - Setup Qdrant

## 💡 Tips

- Chạy test sau mỗi lần thay đổi cấu hình
- So sánh kết quả trước và sau khi optimize
- Lưu lại kết quả test để tracking improvements
- Test với real user queries để realistic hơn
