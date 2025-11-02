# Test Case: Tìm Kiếm Văn Bản Tiền Gửi

## 🐛 Vấn Đề

Khi hỏi về tiền gửi, hệ thống chỉ trả về kết quả về **tiền vay/cho vay**, không tìm được văn bản về **tiền gửi**.

## 📋 Nguyên Nhân Có Thể

1. **Embeddings không phân biệt rõ ràng**: Vector embeddings của "tiền gửi" và "cho vay" có thể gần nhau
2. **Thiếu văn bản tiền gửi**: Database không có hoặc ít văn bản về tiền gửi
3. **Reranking không xem document name**: Algorithm không ưu tiên kết quả có title match
4. **Keyword matching yếu**: Không đủ weight cho exact keyword matches

## 🧪 Test Case Đã Tạo

### Script: `test-search-tiengui.ts`

Test các trường hợp:
1. ✅ "Quy định về tiền gửi là gì?" - Câu hỏi chung
2. ✅ "Lãi suất tiền gửi có kỳ hạn" - Lãi suất
3. ✅ "Tiền gửi không kỳ hạn" - Loại tiền gửi
4. ✅ "Sản phẩm tiền gửi tại ngân hàng" - Sản phẩm
5. ✅ "Điều kiện mở tài khoản tiền gửi" - Điều kiện

### Chạy Test

```bash
cd server
npm run test:tiengui
```

### Kết Quả Test Sẽ Hiển Thị

```
🧪 TEST SUITE: DEPOSIT (TIỀN GỬI) SEARCH
================================================================================

DATABASE CHECK - DEPOSIT DOCUMENTS
Found 1 deposit-related documents:

1. MÔ TẢ SẢN PHẨM TIỀN GỬI
   File: tiengui.pdf
   Status: completed
   Chunks: 15
   Uploaded: 2025-11-01T...

TEST 1: General question about deposits
Query: "Quy định về tiền gửi là gì?"
Expected Keywords: tiền gửi, gửi tiền, gửi
================================================================================

[1] Generating query embedding...
✓ Embedding generated (dimension: 768)

[2] Searching in Qdrant (Top 10)...
✓ Found 10 results

📊 SEARCH RESULTS ANALYSIS:

1. ✅ Score: 0.8234
   Document: MÔ TẢ SẢN PHẨM TIỀN GỬI
   Type: article
   Article: 3
   Preview: Điều 3.1. Tiền gửi có kỳ hạn...

2. ❌ Score: 0.7856
   Document: Quy chế cho vay đối với khách hàng...
   Type: article
   Article: 12
   ⚠️  WARNING: Contains loan keywords - NOT relevant to deposits!
   Preview: ...

📈 STATISTICS:
   Total Results: 10
   Deposit-Relevant: 3 (30%)
   Loan-Related: 7 (70%)
   Average Score: 0.7654

🎯 TEST VERDICT:
   ⚠️  WARNING - Less than 50% results are deposit-relevant
   Issue: 7 loan documents in results
```

## 🔍 Phân Tích

### Các Chỉ Số Quan Trọng

1. **Deposit-Relevant %**: Tỷ lệ kết quả thực sự về tiền gửi
   - Mong đợi: > 70%
   - Thực tế: 30% ❌

2. **Loan-Related %**: Tỷ lệ kết quả về cho vay (không liên quan)
   - Mong đợi: < 20%
   - Thực tế: 70% ❌

3. **Score Distribution**: So sánh score của deposit vs loan docs
   - Nếu deposit docs có score thấp hơn → Vấn đề embeddings

### Kiểm Tra Chi Tiết

Script tự động kiểm tra:
- ✅ Có văn bản tiền gửi trong database không?
- ✅ Văn bản đã được chunk và embed chưa?
- ✅ Search results có chứa từ khóa đúng không?
- ✅ Document name có được ưu tiên không?

## 💡 Giải Pháp Đề Xuất

### 1. Cải Thiện Reranking - Ưu Tiên Document Name Match

**Vấn đề hiện tại:**
```typescript
// Chỉ check content, không check document name
const content = result.payload.content?.toLowerCase() || '';
```

**Giải pháp:**
```typescript
// Thêm bonus cho document name match
const documentNameBonus = queryKeywords.some(kw => 
  docName.toLowerCase().includes(kw)
) ? 0.2 : 0; // Bonus +0.2 nếu query keyword có trong tên document

const baseScore = vectorScore + keywordBonus + documentNameBonus;
```

### 2. Thêm Document Type Filtering

Cho phép user chọn loại văn bản:
```typescript
// In chat query
const documentType = detectDocumentType(query);
// "tiền gửi" → filter by deposit documents
// "cho vay" → filter by loan documents

if (documentType) {
  searchResults = searchResults.filter(r => 
    r.payload.documentName.includes(documentType)
  );
}
```

### 3. Cải Thiện Embeddings với Context

Khi tạo embeddings cho chunks, thêm document name vào context:
```typescript
const textToEmbed = `${documentName}\n\n${chunkContent}`;
const embedding = await generateEmbedding(textToEmbed);
```

### 4. Hybrid Search (Keyword + Semantic)

Kết hợp:
- **Semantic search**: Tìm theo nghĩa (embeddings)
- **Keyword search**: Tìm chính xác từ khóa
- **Weight**: 70% semantic + 30% keyword

## 🚀 Triển Khai Cải Thiện

### Bước 1: Sửa Reranking

File: `server/src/services/qdrant.service.ts`

```typescript
rerankResults(results, query, options) {
  // ... existing code ...
  
  const scoredResults = results.map((result, index) => {
    const vectorScore = result.score;
    
    // Document name matching bonus
    const docName = result.payload.documentName?.toLowerCase() || '';
    let docNameBonus = 0;
    
    queryKeywords.forEach(keyword => {
      if (docName.includes(keyword)) {
        docNameBonus += 0.15; // High bonus for document name match
      }
    });
    
    docNameBonus = Math.min(docNameBonus, 0.3); // Cap at 0.3
    
    // ... existing keyword matching ...
    
    const baseScore = vectorScore + keywordBonus + docNameBonus;
    // ...
  });
}
```

### Bước 2: Thêm Logging

File: `server/src/routes/chat.routes.ts`

Thêm log để debug:
```typescript
console.log(`[Chat] Query keywords detected:`, queryKeywords);
console.log(`[Chat] Document name matches in top 5:`, 
  searchResults.slice(0, 5).map(r => ({
    doc: r.payload.documentName,
    hasKeyword: queryKeywords.some(kw => 
      r.payload.documentName.toLowerCase().includes(kw)
    )
  }))
);
```

### Bước 3: Test Lại

```bash
npm run test:tiengui
```

Kỳ vọng sau khi fix:
- Deposit-Relevant: **> 70%** ✅
- Top 3 results đều là deposit documents ✅

## 📊 Metrics Tracking

Theo dõi các metrics:

| Metric | Before Fix | After Fix | Target |
|--------|-----------|-----------|--------|
| Deposit-Relevant % | 30% | ? | > 70% |
| Loan-Related % | 70% | ? | < 20% |
| Top 1 Accuracy | 0% | ? | > 90% |
| Avg Score (Deposit) | 0.65 | ? | > 0.75 |

## 🎯 Kết Luận

Test case này giúp:
1. ✅ Phát hiện vấn đề search không chính xác
2. ✅ Đo lường độ chính xác với metrics cụ thể
3. ✅ Đề xuất các giải pháp cải thiện
4. ✅ Tracking improvements qua thời gian

Chạy test này sau mỗi lần thay đổi search algorithm để đảm bảo không bị regression.

---

**Created:** 1/11/2025  
**Purpose:** Debug deposit vs loan document search issue
