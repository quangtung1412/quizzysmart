# Cải Tiến: Document Name Matching trong Search

## 📋 Tổng Quan

**Issue:** Khi search "tiền gửi", hệ thống trả về documents về "cho vay" thay vì documents về "tiền gửi"

**Root Cause:** Reranking algorithm chỉ xem keyword trong content, KHÔNG ưu tiên document name

**Solution:** Thêm **Document Name Bonus** vào reranking scoring

---

## 🔧 Thay Đổi Code

### 1. Qdrant Service - Reranking Algorithm

**File:** `server/src/services/qdrant.service.ts`

**Trước:**
```typescript
// Chỉ check content
const content = result.payload.content?.toLowerCase() || '';
let keywordMatches = 0;
queryKeywords.forEach(keyword => {
  if (content.includes(keyword)) keywordMatches += 1;
});
const keywordBonus = ...;
const baseScore = vectorScore + keywordBonus;
```

**Sau:**
```typescript
// 1. Document name matching (HIGH priority)
const documentName = result.payload.documentName?.toLowerCase() || '';
let docNameBonus = 0;

queryKeywords.forEach(keyword => {
  if (documentName.includes(keyword)) {
    docNameBonus += 0.15; // High bonus
  }
});
docNameBonus = Math.min(docNameBonus, 0.3); // Cap at 0.3

// 2. Content matching
const content = result.payload.content?.toLowerCase() || '';
// ... existing code ...
const keywordBonus = ...;

// 3. Combined score with BOTH bonuses
const baseScore = vectorScore + docNameBonus + keywordBonus;
```

**Impact:**
- Document có title match được +0.15 đến +0.3 điểm
- Ví dụ: Document "MÔ TẢ SẢN PHẨM TIỀN GỬI" với query "tiền gửi"
  - Vector score: 0.75
  - Doc name bonus: +0.15 (match "tiền gửi")
  - Final score: **0.90** ⬆️

### 2. Chat Routes - Enhanced Logging

**File:** `server/src/routes/chat.routes.ts`

**Thêm vào cả `/ask` và `/ask-stream`:**

```typescript
// Extract keywords for debugging
const queryKeywords = question.toLowerCase()
  .split(/\s+/)
  .filter((w: string) => w.length > 2);
console.log(`[Chat] Query keywords:`, queryKeywords);

// After reranking - show which results match doc name
searchResults.slice(0, 5).forEach((result: any, idx: number) => {
  const docNameMatch = queryKeywords.some((kw: string) => 
    result.payload.documentName.toLowerCase().includes(kw)
  );
  console.log(`${idx + 1}. Score: ${result.score.toFixed(4)} ${docNameMatch ? '✓ [Doc Name Match]' : ''}`);
  console.log(`   Document: ${result.payload.documentName}`);
  // ...
});
```

---

## 🧪 Test Case

### Script Tạo: `test-search-tiengui.ts`

Test 5 queries về tiền gửi:
1. "Quy định về tiền gửi là gì?"
2. "Lãi suất tiền gửi có kỳ hạn"
3. "Tiền gửi không kỳ hạn"
4. "Sản phẩm tiền gửi tại ngân hàng"
5. "Điều kiện mở tài khoản tiền gửi"

**Chạy test:**
```bash
npm run test:tiengui
```

**Metrics theo dõi:**
- ✅ Deposit-Relevant %: Tỷ lệ kết quả về tiền gửi
- ❌ Loan-Related %: Tỷ lệ kết quả về cho vay (không mong muốn)
- 📊 Top 1 Accuracy: Kết quả đầu tiên có đúng không?

---

## 📊 Kết Quả Mong Đợi

### Trước khi fix:
```
Query: "Lãi suất tiền gửi"

Top 5 Results:
1. Score: 0.78 - Quy chế cho vay... ❌ (loan doc)
2. Score: 0.76 - Quy chế cho vay... ❌ (loan doc)
3. Score: 0.74 - MÔ TẢ SẢN PHẨM TIỀN GỬI ✅ (deposit doc)
4. Score: 0.72 - Quy chế cho vay... ❌ (loan doc)
5. Score: 0.70 - Quy chế cho vay... ❌ (loan doc)

Deposit-Relevant: 20% ❌
```

### Sau khi fix:
```
Query: "Lãi suất tiền gửi"

Top 5 Results:
1. Score: 0.89 ✓ [Doc Name Match] - MÔ TẢ SẢN PHẨM TIỀN GỬI ✅
2. Score: 0.86 ✓ [Doc Name Match] - MÔ TẢ SẢN PHẨM TIỀN GỬI ✅
3. Score: 0.82 ✓ [Doc Name Match] - MÔ TẢ SẢN PHẨM TIỀN GỬI ✅
4. Score: 0.78 - Quy chế cho vay... ⚠️
5. Score: 0.76 - Quy chế cho vay... ⚠️

Deposit-Relevant: 60% ✅ (hoặc cao hơn)
```

---

## 🎯 Scoring Logic Chi Tiết

### Formula
```
rerankScore = (vectorScore + docNameBonus + keywordBonus) * positionPenalty
```

### Components:

1. **vectorScore** (0.5 - 1.0): Cosine similarity từ Qdrant
2. **docNameBonus** (0 - 0.3): 
   - +0.15 per keyword match trong document name
   - Cap tối đa 0.3
3. **keywordBonus** (0 - 0.1):
   - Dựa trên keyword matches trong content
   - Weight = 0.1
4. **positionPenalty** (0.95 - 1.0):
   - Ưu tiên kết quả đầu tiên một chút
   - 1 - (index / total) * 0.05

### Ví Dụ Tính Toán:

**Document A: "MÔ TẢ SẢN PHẨM TIỀN GỬI"**
```
Query: "lãi suất tiền gửi"
Keywords: ["lãi", "suất", "tiền", "gửi"]

vectorScore = 0.75
docNameBonus = 0.15 (match "tiền") + 0.15 (match "gửi") = 0.30
keywordBonus = 0.08 (từ content)
positionPenalty = 1.0

rerankScore = (0.75 + 0.30 + 0.08) * 1.0 = 1.13
```

**Document B: "Quy chế cho vay"**
```
Query: "lãi suất tiền gửi"
Keywords: ["lãi", "suất", "tiền", "gửi"]

vectorScore = 0.78
docNameBonus = 0 (no match)
keywordBonus = 0.05 (ít match hơn)
positionPenalty = 0.99

rerankScore = (0.78 + 0 + 0.05) * 0.99 = 0.82
```

**Result:** Document A (1.13) > Document B (0.82) ✅

---

## 📝 Logging Output Mẫu

```bash
[Chat] Query keywords: [ 'lãi', 'suất', 'tiền', 'gửi' ]

[Chat DEBUG] Original Qdrant Search Results (Top 5):
  1. Score: 0.7800
     Document: Quy chế cho vay đối với khách hàng...
     Article: 11
     Preview: Điều 11. Lãi suất cho vay...

  2. Score: 0.7500
     Document: MÔ TẢ SẢN PHẨM TIỀN GỬI
     Article: 3
     Preview: Điều 3.1. Tiền gửi có kỳ hạn...

[Chat DEBUG] After Reranking (Top 5):
  1. Score: 1.0500 ✓ [Doc Name Match]
     Document: MÔ TẢ SẢN PHẨM TIỀN GỬI  <-- Đã lên top!
     Article: 3
     Preview: Điều 3.1. Tiền gửi có kỳ hạn...

  2. Score: 0.7722
     Document: Quy chế cho vay đối với khách hàng...
     Article: 11
     Preview: Điều 11. Lãi suất cho vay...
```

---

## ✅ Checklist Validation

- [x] Code đã được update
- [x] Test case đã được tạo
- [x] Logging đã được thêm
- [x] Documentation đã được viết
- [ ] Test với real data
- [ ] Kiểm tra không ảnh hưởng các query khác
- [ ] Monitor metrics trong production

---

## 🚀 Triển Khai

1. **Restart server**
   ```bash
   npm run dev
   ```

2. **Chạy test**
   ```bash
   npm run test:tiengui
   ```

3. **Kiểm tra chat UI**
   - Test query: "Lãi suất tiền gửi"
   - Xem sources trả về
   - Kiểm tra confidence score

4. **Monitor logs**
   - Check terminal logs
   - Verify document name matches được highlight
   - Confirm scores tăng cho matching documents

---

**Created:** 1/11/2025  
**Impact:** High - Cải thiện đáng kể độ chính xác search  
**Risk:** Low - Chỉ thêm bonus, không thay đổi core logic
