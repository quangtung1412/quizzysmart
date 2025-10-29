# RAG IMPLEMENTATION GUIDE - ADMIN FEATURES

## 📝 TỔNG QUAN

Đã hoàn thành PHASE 1: Backend Foundation cho chức năng RAG (Admin Features)

## ✅ CÁC FILE ĐÃ TẠO

### 1. Backend Types & Schema
- ✅ `server/prisma/schema.prisma` - Thêm 3 models: Document, DocumentChunk, ChatMessage
- ✅ `server/src/types/rag.types.ts` - TypeScript interfaces cho RAG system

### 2. Backend Services
- ✅ `server/src/services/qdrant.service.ts` - Qdrant Cloud integration
- ✅ `server/src/services/gemini-rag.service.ts` - Gemini PDF extraction, embedding, RAG
- ✅ `server/src/services/pdf-processor.service.ts` - PDF processing với dynamic chunking

### 3. Backend Middleware & Routes
- ✅ `server/src/middleware/upload.middleware.ts` - Multer upload config (10 files, 50MB)
- ✅ `server/src/routes/document.routes.ts` - Document management endpoints

### 4. Dependencies Updated
- ✅ `server/package.json` - Thêm @qdrant/js-client-rest, multer, pdf-parse, markdown-it

## 🔧 CÁC BƯỚC TIẾP THEO

### BƯỚC 1: Cài đặt dependencies
```powershell
cd server
npm install
```

### BƯỚC 2: Cấu hình Environment Variables
Thêm vào `server/.env`:
```env
# Qdrant Configuration
QDRANT_URL=https://your-cluster.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key
QDRANT_COLLECTION_NAME=vietnamese_documents

# File Upload Settings
UPLOAD_DIR=./uploads/documents
MAX_FILE_SIZE=52428800
```

### BƯỚC 3: Chạy Prisma Migration
```powershell
cd server
npm run prisma:migrate
```
Tên migration: `add_rag_models`

### BƯỚC 4: Tích hợp vào index.ts
Cần thêm vào `server/src/index.ts`:

```typescript
// Import
import documentRoutes from './routes/document.routes.js';
import { qdrantService } from './services/qdrant.service.js';
import { pdfProcessorService } from './services/pdf-processor.service.js';

// Initialize Qdrant (sau khi tạo httpServer)
await qdrantService.initialize();

// Set Socket.IO for PDF processor
pdfProcessorService.setSocketIO(io);

// Mount routes
app.use('/api/documents', documentRoutes);
```

### BƯỚC 5: Frontend Components (Chưa tạo)
Cần tạo:
- `components/admin/DocumentManagement.tsx` - Main component
- `components/admin/DocumentUpload.tsx` - Upload UI
- `components/admin/DocumentList.tsx` - List documents
- `components/admin/DocumentDetail.tsx` - View document detail

### BƯỚC 6: Update AdminDashboard
Thêm tab "Quản lý Văn bản" vào admin panel.

## 📊 CHIẾN LƯỢC CHUNKING

### Dynamic Chunking theo cấu trúc văn bản:
1. **Overview Chunk** (1 chunk) - Metadata tổng quan
2. **Basis Chunk** (1 chunk nếu có) - Căn cứ pháp lý
3. **Article Chunks** - Mỗi điều là 1 chunk riêng
   - Bao gồm: số điều, tên điều, các khoản, các điểm
   - Metadata: chương (nếu có), điều, khoản
4. **Appendix Chunks** - Mỗi phụ lục 1 chunk

### Ưu điểm:
- ✅ Giữ nguyên cấu trúc pháp lý
- ✅ Dễ truy vết nguồn (Điều X, Khoản Y)
- ✅ Chunk size linh hoạt theo nội dung thực tế
- ✅ Phù hợp với cách truy vấn văn bản pháp luật

## 🔄 WORKFLOW HOÀN CHỈNH

### Admin Upload Flow:
```
1. Admin uploads PDFs (max 10 files, 50MB each)
   ↓
2. Create Document records (status: processing)
   ↓
3. Background processing starts:
   a. Upload PDF to Gemini File API
   b. Extract structured content (JSON)
   c. Save metadata to Database
   d. Create chunks theo cấu trúc
   e. Generate embeddings (Google)
   f. Upload vectors to Qdrant
   g. Update status: completed
   ↓
4. Real-time updates via Socket.IO
```

## 🎯 API ENDPOINTS

### Document Management (Admin Only)
- `POST /api/documents/upload` - Upload multiple PDFs
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get document detail
- `GET /api/documents/:id/chunks` - Get document chunks
- `DELETE /api/documents/:id` - Delete document

## 🔐 SECURITY

- ✅ Chỉ admin mới có quyền upload và quản lý documents
- ✅ File validation: chỉ PDF
- ✅ Size limit: 50MB per file
- ✅ Count limit: 10 files per request
- ✅ Unique filenames với timestamp

## 📌 LƯU Ý QUAN TRỌNG

### 1. Qdrant Cloud Setup
Cần tạo account và cluster tại: https://cloud.qdrant.io
- Free tier: 1GB storage
- Lấy URL và API Key

### 2. Google Gemini API
- Sử dụng Gemini File API để upload PDF
- Model extraction: sử dụng model rotation
- Embedding model: `text-embedding-004` (768 dimensions)

### 3. TypeScript Errors
Một số lỗi TypeScript hiện tại sẽ được giải quyết sau khi:
- Install packages
- Run migration (generate Prisma Client)
- Update @google/generative-ai (check GoogleAIFileManager)

### 4. File Storage
- Default: `./uploads/documents/`
- Cần tạo thư mục này hoặc config UPLOAD_DIR

## 🚀 TESTING

### Manual Testing Steps:
1. Start server: `npm run dev`
2. Login as admin
3. Navigate to Document Management
4. Upload a PDF legal document
5. Monitor Socket.IO events for progress
6. Check document detail page
7. Verify chunks in database
8. Verify vectors in Qdrant

### Sample Test Document:
Sử dụng bất kỳ văn bản pháp luật VN nào (PDF):
- Thông tư
- Nghị định
- Quyết định
- Luật

## 📝 NEXT STEPS

Sau khi hoàn thành các bước trên, tiếp tục với:

### Phase 2: User Chat Interface
- Chat screen với RAG query
- Display sources và references
- Chat history
- Premium feature restriction

### Phase 3: Optimization
- Caching strategies
- Batch processing
- Error retry logic
- Performance monitoring

---

## ❓ CÂU HỎI CẦN TRẢ LỜI

Trước khi tiếp tục tạo Frontend components, cần xác nhận:

1. **Qdrant Setup**: Bạn đã tạo Qdrant Cloud account chưa?
2. **Environment**: Cần tôi giúp cập nhật .env file không?
3. **Integration**: Bạn muốn tôi tích hợp vào index.ts ngay bây giờ không?
4. **Frontend**: Bắt đầu tạo Admin UI components không?

Vui lòng cho biết bạn muốn tiếp tục bước nào tiếp theo!
