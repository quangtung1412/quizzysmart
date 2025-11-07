# Phân tách API Key cho Import và Chat

## Tổng quan

Đã cấu hình hệ thống sử dụng 2 API key riêng biệt:
- **GEMINI_API_KEY_IMPORT**: Dùng cho các tác vụ import và embedding file
- **GEMINI_API_KEY**: Dùng cho embedding câu hỏi chat của người dùng

## Lý do

- Tách biệt quota giữa hoạt động import (tốn nhiều quota) và chat (sử dụng thường xuyên)
- Tránh ảnh hưởng đến trải nghiệm người dùng khi import file lớn
- Dễ quản lý và theo dõi usage của từng loại hoạt động

## Các thay đổi đã thực hiện

### 1. `gemini-rag.service.ts`

**Thay đổi constructor:**
```typescript
// Trước
constructor() {
  const apiKey = process.env.GEMINI_API_KEY;
  // ...
}

// Sau
constructor(apiKey?: string) {
  // Allow custom API key, default to GEMINI_API_KEY
  const key = apiKey || process.env.GEMINI_API_KEY;
  // ...
}
```

**Export 2 instances:**
```typescript
// Default instance using GEMINI_API_KEY for chat queries
export const geminiRAGService = new GeminiRAGService();

// Import instance using GEMINI_API_KEY_IMPORT for file import/embedding
export const geminiRAGServiceImport = new GeminiRAGService(process.env.GEMINI_API_KEY_IMPORT);
```

### 2. `pdf-processor.service.ts`

**Import service mới:**
```typescript
// Trước
import { geminiRAGService } from './gemini-rag.service.js';

// Sau
import { geminiRAGServiceImport } from './gemini-rag.service.js'; // Use IMPORT service for file processing
```

**Cập nhật tất cả các lệnh gọi:**
- `processDocument()`: Sử dụng `geminiRAGServiceImport` cho upload PDF, extract content, và generate embeddings
- `reEmbedDocument()`: Sử dụng `geminiRAGServiceImport` cho regenerate embeddings
- `embedAndUploadChunks()`: Sử dụng `geminiRAGServiceImport` cho batch embedding

### 3. Các file KHÔNG thay đổi (vẫn dùng GEMINI_API_KEY)

**`chat.routes.ts`** - Embedding câu hỏi chat:
```typescript
import { geminiRAGService } from '../services/gemini-rag.service.js';

// Embedding câu hỏi người dùng
const questionEmbedding = await geminiRAGService.generateEmbedding(question);
```

**`query-analyzer.service.ts`** - Phân tích câu hỏi:
```typescript
// Vẫn dùng GEMINI_API_KEY cho model gemini-2.0-flash-lite
const apiKey = process.env.GEMINI_API_KEY;
```

**Test files** - Các file test search/chat:
- `test-qdrant-search.ts`
- `test-search-tiengui.ts`

## Cách sử dụng

### 1. Thêm API key vào file `.env`

```env
# API key cho chat và query thông thường
GEMINI_API_KEY=your_chat_api_key_here

# API key cho import và embedding file
GEMINI_API_KEY_IMPORT=your_import_api_key_here
```

### 2. Hoạt động tự động

Hệ thống sẽ tự động sử dụng đúng API key cho từng tác vụ:

**Sử dụng GEMINI_API_KEY_IMPORT:**
- Upload PDF lên Gemini
- Extract nội dung từ PDF
- Generate embeddings cho chunks của document
- Re-generate embeddings cho document

**Sử dụng GEMINI_API_KEY:**
- Embedding câu hỏi của người dùng khi chat
- Phân tích câu hỏi (query analyzer)
- Generate câu trả lời RAG
- Tất cả các hoạt động chat thông thường

## Lợi ích

### 1. Quản lý Quota tốt hơn
- Import files không ảnh hưởng đến quota của chat
- Có thể monitor riêng biệt usage của từng loại hoạt động

### 2. Hiệu suất
- Chat không bị chậm do quota limit khi đang import file lớn
- Có thể scale độc lập 2 loại hoạt động

### 3. Bảo mật
- Có thể giới hạn permissions khác nhau cho 2 keys
- Dễ dàng rotate key mà không ảnh hưởng toàn bộ hệ thống

## Kiểm tra

### 1. Kiểm tra import file
```bash
# Upload một file PDF qua admin panel
# Xem logs để confirm đang dùng GEMINI_API_KEY_IMPORT
```

### 2. Kiểm tra chat
```bash
# Gửi câu hỏi qua chat
# Xem logs để confirm đang dùng GEMINI_API_KEY
```

### 3. Monitor quota
- Kiểm tra quota usage riêng biệt cho từng API key tại: https://aistudio.google.com/apikey

## Lưu ý

1. **API key bắt buộc**: Cả 2 API keys đều phải được cấu hình trong file `.env`
2. **Fallback**: Nếu `GEMINI_API_KEY_IMPORT` không được cấu hình, sẽ fallback về `GEMINI_API_KEY`
3. **Testing**: Các file test hiện tại vẫn sử dụng `GEMINI_API_KEY` (không ảnh hưởng)

## Troubleshooting

### Lỗi: "GEMINI_API_KEY not found"
- Kiểm tra file `.env` có tồn tại
- Đảm bảo `GEMINI_API_KEY` được định nghĩa

### Import file bị lỗi quota
- Kiểm tra `GEMINI_API_KEY_IMPORT` có được cấu hình đúng
- Verify API key tại Google AI Studio
- Kiểm tra quota limit của key

### Chat bị chậm hoặc lỗi
- Kiểm tra quota của `GEMINI_API_KEY`
- Đảm bảo key không bị rate limit
