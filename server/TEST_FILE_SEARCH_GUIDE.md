# 🧪 Google File Search Testing Guide

Hướng dẫn test và debug tính năng Google File Search.

## 📋 Yêu cầu

- Node.js >= 18
- GEMINI_API_KEY trong `.env`
- File Search Store đã được tạo và có documents

## 🚀 Chạy Test

### Cách 1: Sử dụng npm script
```bash
cd server
npm run test:filesearch
```

### Cách 2: Chạy trực tiếp
```bash
cd server
npx tsx test-file-search.ts
```

## ⚙️ Cấu hình

### 1. Thiết lập Store Name

Trong file `.env`, thêm:
```bash
FILE_SEARCH_STORE_NAME=fileSearchStores/your-store-id
```

Hoặc script sẽ dùng default: `fileSearchStores/loan-a7i3ilp7o143`

### 2. Custom Test Questions

Sửa array `TEST_QUESTIONS` trong `test-file-search.ts`:
```typescript
const TEST_QUESTIONS = [
    'Your question 1?',
    'Your question 2?',
    // ... thêm câu hỏi của bạn
];
```

## 📊 Test Cases

Script sẽ chạy 6 test cases:

### ✅ Test 1: List All Stores
- Liệt kê tất cả File Search stores
- Hiển thị name, displayName, createTime

### ✅ Test 2: Get Specific Store
- Lấy thông tin chi tiết của store cụ thể
- Verify store tồn tại

### ✅ Test 3: Non-streaming Query
- Query câu hỏi và nhận full response
- Hiển thị answer, sources, citations
- Đo thời gian response và token usage

### ✅ Test 4: Streaming Query
- Query với streaming response
- Hiển thị real-time output
- Test user experience

### ✅ Test 5: Metadata Filter
- Test query với metadata filter
- Ví dụ: `documentType="loan_policy"`

### ✅ Test 6: Performance Benchmark
- Test nhiều câu hỏi liên tiếp
- Tính average duration, sources, citations
- Đo success rate

## 📈 Output Mẫu

```
================================================================================
🔍 GOOGLE FILE SEARCH - TEST SCRIPT
================================================================================

✓ API Key configured

================================================================================
📁 Test 1: List All File Search Stores
================================================================================

Found 2 store(s):
  1. Loan Documents
     Name: fileSearchStores/loan-a7i3ilp7o143
     Created: 2025-11-15T10:30:00Z
  2. Policy Documents
     Name: fileSearchStores/policy-xyz456
     Created: 2025-11-16T08:20:00Z

================================================================================
💬 Test 3: Query File Search (Non-streaming)
================================================================================

Question: "Điều kiện vay thế chấp là gì?"
Querying...

✓ Query successful!

────────────────────────────────────────────────────────────────────────────────
📝 Answer:
Để vay thế chấp tại Agribank, khách hàng cần đáp ứng các điều kiện sau:
1. Có tài sản thế chấp hợp pháp
2. Thu nhập ổn định, đủ khả năng trả nợ
3. Không nằm trong danh sách đen
...
────────────────────────────────────────────────────────────────────────────────

📊 Metadata:
  Model: gemini-2.5-flash-lite-preview-09-2025
  Confidence: 85%
  Sources: 3
  Citations: 5
  Duration: 2341ms
  Tokens: 1523 (input: 856, output: 667)

────────────────────────────────────────────────────────────────────────────────
📚 Sources:

  1. Quy định vay thế chấp 2025
     URI: files/abc123xyz
     Score: 1.0
     Preview: Điều 5. Điều kiện vay thế chấp...

  2. Hướng dẫn xét duyệt vay
     URI: files/def456uvw
     Score: 1.0
     Preview: Khách hàng cần có tài sản...

────────────────────────────────────────────────────────────────────────────────
🔗 Citations (Answer → Source Mapping):

  1. "Có tài sản thế chấp hợp pháp"
     From sources: [0, 1]
     Confidence: 95%, 88%

  2. "Thu nhập ổn định, đủ khả năng trả nợ"
     From sources: [1]
     Confidence: 92%

...

================================================================================
📈 Performance Summary:
================================================================================

  Success Rate: 4/4 (100%)
  Average Duration: 2156ms
  Average Sources: 2.8
  Average Citations: 4.5
  Total Tokens Used: 5842

================================================================================
✅ TEST COMPLETED
================================================================================

All tests finished successfully!
```

## 🔍 Debug Tips

### Issue: Store not found
```
✗ Store not found
  Make sure STORE_NAME is correct: fileSearchStores/...
```

**Solution:**
1. Chạy test để list all stores
2. Copy đúng store name từ output
3. Update `FILE_SEARCH_STORE_NAME` trong `.env`

### Issue: API Key error
```
✗ GEMINI_API_KEY not found in .env file
```

**Solution:**
1. Check file `.env` có tồn tại không
2. Verify có dòng `GEMINI_API_KEY=your_key_here`
3. Restart terminal/IDE sau khi update

### Issue: Empty response
```
✗ Query failed: Empty response from Gemini
```

**Possible causes:**
1. Store chưa có documents
2. Documents chưa được indexed (đang PROCESSING)
3. API key hết quota
4. Model không hỗ trợ File Search

**Solution:**
- Check store có documents: Admin panel → RAG Configuration
- Đợi vài phút để documents được indexed
- Check Gemini API console cho quota

### Issue: No sources/citations
```
Sources: 0
Citations: 0
```

**Possible causes:**
1. Documents không liên quan đến câu hỏi
2. File Search không tìm thấy match
3. Documents chưa được chunked/embedded

**Solution:**
- Thử câu hỏi khác phù hợp với nội dung documents
- Check document content có đúng không
- Re-upload documents nếu cần

## 📝 Customize Tests

### Thêm test case mới

Trong `test-file-search.ts`, thêm vào cuối hàm `testFileSearch()`:

```typescript
// Test 7: Your custom test
section('🎯 Test 7: Your Custom Test');
log('Testing custom functionality...', colors.yellow);

try {
    const response = await geminiFileSearchService.generateRAGAnswer(
        { 
            question: 'Your question?',
            topK: 5 
        },
        [STORE_NAME],
        'your_filter="value"' // optional
    );

    log('✓ Custom test passed!', colors.green);
    console.log(response);
} catch (error: any) {
    log(`✗ Custom test failed: ${error.message}`, colors.red);
}
```

### Test với multiple stores

```typescript
const response = await geminiFileSearchService.generateRAGAnswer(
    { question: 'Your question?' },
    [
        'fileSearchStores/store1',
        'fileSearchStores/store2',
        'fileSearchStores/store3'
    ]
);
```

### Test với metadata filter

```typescript
// Filter by author
const response = await geminiFileSearchService.generateRAGAnswer(
    { question: 'Your question?' },
    [STORE_NAME],
    'author="John Doe"'
);

// Filter by year
const response = await geminiFileSearchService.generateRAGAnswer(
    { question: 'Your question?' },
    [STORE_NAME],
    'year>2020'
);

// Complex filter
const response = await geminiFileSearchService.generateRAGAnswer(
    { question: 'Your question?' },
    [STORE_NAME],
    'documentType="policy" AND year>=2024'
);
```

## 📚 API Reference

### generateRAGAnswer()
```typescript
await geminiFileSearchService.generateRAGAnswer(
    query: RAGQuery,
    fileSearchStoreNames: string[],
    metadataFilter?: string
): Promise<RAGResponse>
```

**Parameters:**
- `query`: Object với `question` (string) và optional `topK` (number)
- `fileSearchStoreNames`: Array of store names (e.g., `['fileSearchStores/abc123']`)
- `metadataFilter`: Optional filter string (e.g., `'author="John"'`)

**Returns:**
- `answer`: Generated answer text
- `sources`: Array of retrieved document chunks
- `citations`: Array of citation mappings (text → source)
- `model`: Model name used
- `confidence`: Confidence score (0-100)
- `tokenUsage`: Input/output/total tokens

### generateRAGAnswerStream()
```typescript
for await (const { chunk, done, metadata } of service.generateRAGAnswerStream(...)) {
    if (!done) {
        // Process chunk
    } else {
        // Get final metadata
    }
}
```

Same parameters as `generateRAGAnswer()`, but streams response in real-time.

## 🎯 Best Practices

1. **Always check store exists** before querying
2. **Use streaming** for better UX in production
3. **Monitor token usage** to control costs
4. **Log citations** để verify sources
5. **Test với nhiều câu hỏi** để đánh giá quality
6. **Use metadata filters** khi có nhiều documents

## 🐛 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Store not found | Wrong store name | List stores và copy đúng name |
| API key error | Missing/invalid key | Check `.env` file |
| Empty response | No matching documents | Try different questions |
| Timeout | Large documents | Increase timeout or reduce doc size |
| No citations | Documents not indexed | Wait for indexing to complete |
| Low confidence | Poor document quality | Improve document content |

## 📞 Support

- Documentation: https://ai.google.dev/gemini-api/docs/file-search
- Issues: Check logs for detailed error messages
- Debugging: Use `console.log()` trong test script

## 🔄 Next Steps

1. ✅ Chạy test để verify setup
2. ✅ Test với các câu hỏi thực tế
3. ✅ Monitor performance và token usage
4. ✅ Tối ưu confidence scores
5. ✅ Setup metadata filters nếu cần
6. ✅ Integrate vào production code

Happy testing! 🚀
