# RAG Configuration - Hướng Dẫn Sử Dụng

## Tổng Quan

Hệ thống RAG (Retrieval-Augmented Generation) của bạn hiện hỗ trợ 2 phương thức:

1. **Qdrant** - Hệ thống RAG tự xây dựng với vector database
2. **Google File Search** - Sử dụng File Search API của Google Gemini

## So Sánh Hai Phương Thức

### 1. Qdrant (Self-hosted RAG)

**✅ Ưu điểm:**
- Kiểm soát hoàn toàn chunking strategy và metadata
- Tùy chỉnh embedding và filtering theo nhu cầu
- Self-hosted, không phụ thuộc vào dịch vụ bên ngoài
- Chi phí cố định, không tính theo usage
- Reranking và filtering tùy chỉnh

**⚠️ Nhược điểm:**
- Cần quản lý infrastructure (Qdrant server)
- Phải tự implement chunking logic
- Tốn thời gian setup ban đầu

**📊 Phù hợp khi:**
- Cần kiểm soát hoàn toàn hệ thống
- Có infrastructure sẵn
- Cần tùy chỉnh chi tiết chunking/metadata
- Muốn tránh chi phí biến đổi theo usage

### 2. Google File Search

**✅ Ưu điểm:**
- Tự động chunking và indexing, không cần implement
- Không cần quản lý infrastructure
- Grounding metadata và citations tự động
- Hỗ trợ nhiều loại file (PDF, DOC, TXT, etc.)
- Setup nhanh, chỉ cần upload

**⚠️ Nhược điểm:**
- Phụ thuộc vào Google API
- Chi phí embedding: $0.15 per 1M tokens
- Storage limits theo tier:
  - Free: 1 GB
  - Tier 1: 10 GB
  - Tier 2: 100 GB
  - Tier 3: 1 TB
- Ít kiểm soát hơn về chunking strategy

**📊 Phù hợp khi:**
- Muốn setup nhanh, không cần infrastructure
- Không cần tùy chỉnh chi tiết
- Dữ liệu không quá lớn (dưới giới hạn tier)
- Ưu tiên convenience hơn control

## Cách Sử Dụng

### A. Chuyển Sang Qdrant

1. Vào **Admin Panel** → **Cài đặt hệ thống** → **Cấu hình RAG**
2. Chọn **Qdrant (Tự xây dựng)**
3. Click **Lưu cài đặt**

Sau khi lưu:
- Tất cả queries sẽ được xử lý qua Qdrant
- Sử dụng embeddings đã có trong Qdrant collections
- Có thể tùy chỉnh reranking và filtering

### B. Chuyển Sang Google File Search

#### Bước 1: Tạo File Search Store

1. Vào **Admin Panel** → **Cài đặt hệ thống** → **Cấu hình RAG**
2. Chọn **Google File Search**
3. Click **+ Tạo store mới**
4. Nhập tên store (VD: `vietnamese-documents-store`)
5. Click **Tạo**

#### Bước 2: Upload Tài Liệu Vào Store

**Cách 1: Qua API (nếu đã có tài liệu trong database)**

```bash
POST /api/rag-config/upload-to-file-search
{
  "documentId": "document-id-here",
  "storeName": "fileSearchStores/vietnamese-documents-store"
}
```

**Cách 2: Upload trực tiếp từ giao diện**

Tính năng này đang được phát triển trong trang **Quản lý tài liệu**.

#### Bước 3: Kích Hoạt

1. Trong danh sách stores, chọn store vừa tạo
2. Click **Lưu cài đặt**

Sau khi lưu:
- Tất cả queries sẽ được xử lý qua Google File Search
- Sử dụng grounding metadata từ Google
- Citations tự động

## API Reference

### Get RAG Configuration

```bash
GET /api/rag-config
```

Response:
```json
{
  "success": true,
  "config": {
    "method": "qdrant",
    "fileSearchStoreName": null
  },
  "stats": {
    "method": "qdrant",
    "collections": 2,
    "totalPoints": 1234,
    "collectionDetails": [
      { "name": "vietnamese_documents", "points": 1000 },
      { "name": "tiengui_collection", "points": 234 }
    ]
  }
}
```

### Set RAG Configuration

```bash
POST /api/rag-config
Content-Type: application/json

{
  "method": "google-file-search",
  "fileSearchStoreName": "fileSearchStores/vietnamese-documents-store"
}
```

### List File Search Stores

```bash
GET /api/rag-config/file-search-stores
```

Response:
```json
{
  "success": true,
  "stores": [
    {
      "name": "fileSearchStores/vietnamese-documents-store",
      "displayName": "Vietnamese Documents Store",
      "createTime": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create File Search Store

```bash
POST /api/rag-config/file-search-stores
Content-Type: application/json

{
  "displayName": "Vietnamese Documents Store"
}
```

### Delete File Search Store

```bash
DELETE /api/rag-config/file-search-stores/:storeName
```

⚠️ **Lưu ý:** Không thể xóa store đang được sử dụng.

### Upload Document to File Search

```bash
POST /api/rag-config/upload-to-file-search
Content-Type: application/json

{
  "documentId": "clxxx...",
  "storeName": "fileSearchStores/vietnamese-documents-store"
}
```

## Schema Changes

### System Settings Table

Đã thêm 2 fields mới:

```prisma
model SystemSettings {
  // ... existing fields
  ragMethod           String   @default("qdrant") // 'qdrant' or 'google-file-search'
  fileSearchStoreName String?  // Name of Google File Search store
}
```

### Document Table

Đã thêm 3 fields mới:

```prisma
model Document {
  // ... existing fields
  fileSearchStoreName     String? // Name of File Search store
  fileSearchDocumentName  String? // Document name in File Search store
  ragMethod               String  @default("qdrant") // 'qdrant' or 'google-file-search'
}
```

## Migration Commands

Sau khi pull code, chạy:

```bash
cd server
npx prisma migrate dev --name add-rag-config
npx prisma generate
```

## Testing

### Test Qdrant Method

1. Chọn Qdrant trong admin
2. Vào Chat và hỏi câu hỏi
3. Kiểm tra response có đúng từ Qdrant không

### Test Google File Search Method

1. Tạo store mới
2. Upload tài liệu vào store
3. Chọn Google File Search và store trong admin
4. Vào Chat và hỏi câu hỏi
5. Kiểm tra response có grounding metadata không

## Troubleshooting

### "File Search store không tồn tại"

**Nguyên nhân:** Store name không đúng hoặc đã bị xóa

**Giải pháp:**
1. Vào danh sách stores và kiểm tra tên chính xác
2. Tạo store mới nếu cần

### "Cannot delete store that is currently in use"

**Nguyên nhân:** Đang cố xóa store đang được sử dụng

**Giải pháp:**
1. Chuyển sang Qdrant hoặc store khác
2. Sau đó mới xóa store

### "Không tìm thấy thông tin liên quan"

**Nguyên nhân:** 
- File chưa được upload vào store (nếu dùng File Search)
- Collection trống (nếu dùng Qdrant)

**Giải pháp:**
1. Kiểm tra xem tài liệu đã được upload chưa
2. Kiểm tra stats để xem số lượng documents/vectors

### Quota exceeded (Google File Search)

**Nguyên nhân:** Vượt quá giới hạn storage của tier

**Giải pháp:**
1. Upgrade tier của Google API
2. Hoặc chuyển về Qdrant
3. Xóa bớt documents không cần thiết

## Best Practices

### Khi Nào Dùng Qdrant?

- ✅ Bạn đã có infrastructure sẵn
- ✅ Cần tùy chỉnh chi tiết chunking
- ✅ Muốn self-hosted, không phụ thuộc external API
- ✅ Chi phí infrastructure thấp hơn chi phí API

### Khi Nào Dùng Google File Search?

- ✅ Muốn setup nhanh
- ✅ Không có infrastructure sẵn
- ✅ Dữ liệu không quá lớn
- ✅ Ưu tiên convenience

### Hybrid Approach

Bạn có thể:
- Dùng Qdrant cho production (cost-effective, controlled)
- Dùng Google File Search cho testing/demo (quick setup)
- Chuyển đổi linh hoạt giữa hai phương thức

## References

- [Google File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
