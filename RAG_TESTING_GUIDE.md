# RAG System Testing Guide

## 🚀 Hướng dẫn Test RAG System

### Bước 1: Setup & Start Server

```powershell
# Terminal 1: Start backend server
cd server
npm run dev
```

```powershell
# Terminal 2: Start frontend
cd ..
npm run dev
```

### Bước 2: Kiểm tra Khởi động

**Backend Console - Cần thấy:**
```
[RAG] Initializing Qdrant service...
[Qdrant] Initializing connection to: https://...
[Qdrant] Connection established successfully
[Qdrant] Collection "quizzysmart" already exists
[RAG] Qdrant service initialized successfully
API server on :3000
```

**Nếu thấy lỗi:**
- `QDRANT_URL not configured` → Check .env file
- `Connection refused` → Check Qdrant URL/API Key
- `Failed to initialize Qdrant` → RAG sẽ bị disabled nhưng app vẫn chạy

### Bước 3: Truy cập Admin Panel

1. Login với tài khoản admin
2. Click vào Admin Dashboard
3. Chọn tab **"📄 Quản lý Văn bản (RAG)"**

### Bước 4: Test Upload PDF

**Test Case 1: Upload 1 file PDF nhỏ**
1. Chuẩn bị file PDF văn bản (< 10MB)
2. Drag & drop vào ô upload
3. Click "Upload"
4. Quan sát:
   - ✅ File xuất hiện trong danh sách
   - ✅ Status: "⏳ Đang xử lý"
   - ✅ Progress bar hiển thị (real-time qua Socket.IO)
   - ✅ Các bước: Upload → Trích xuất → Lưu → Embedding → Hoàn thành

**Test Case 2: Upload nhiều files**
1. Chọn 2-3 files PDF
2. Upload cùng lúc
3. Quan sát tất cả files được xử lý song song

**Test Case 3: Lỗi - File không phải PDF**
1. Chọn file .docx hoặc .txt
2. Thấy thông báo: "Chỉ chấp nhận file PDF!"

**Test Case 4: Lỗi - File quá lớn**
1. Upload file > 50MB
2. Backend trả lỗi: "File quá lớn"

### Bước 5: Kiểm tra Processing

**Trong quá trình xử lý, check backend console:**

```
[PDFProcessor] Starting processing for document xxx
[Gemini] Uploading PDF: filename.pdf
[Gemini] PDF uploaded successfully
[Gemini] Extracting content from: gs://...
[Gemini] Extraction completed, model: gemini-2.0-flash-exp
[PDFProcessor] Created 15 chunks
[Gemini] Generating embeddings for 15 texts
[Gemini] Generated 15 embeddings
[Qdrant] Upserted 15 points
[PDFProcessor] Successfully embedded and uploaded 15 chunks
[PDFProcessor] Document xxx processed successfully
```

**Trên UI:**
- Progress bar 0% → 100%
- Các bước hiển thị:
  - "Đang upload PDF lên Gemini..."
  - "Đang trích xuất nội dung văn bản..."
  - "Đang lưu metadata và nội dung..."
  - "Đang phân đoạn văn bản..."
  - "Đang tạo embeddings..."
  - "Hoàn thành!"

### Bước 6: Kiểm tra Document List

**Sau khi hoàn thành:**
- ✅ Status đổi thành "✓ Hoàn thành"
- ✅ Hiển thị metadata:
  - Số văn bản
  - Loại văn bản
  - File name
  - Ngày upload
  - Số chunks

### Bước 7: Test Delete

1. Click nút "🗑️ Xóa"
2. Confirm
3. Document biến mất khỏi list
4. Backend console: `[Qdrant] Deleted all points for document: xxx`

### Bước 8: Kiểm tra Qdrant Dashboard (Optional)

1. Truy cập Qdrant Cloud Dashboard
2. Chọn cluster
3. Tab "Collections" → "quizzysmart"
4. Xem số vectors (points count)
5. Tab "Browse" → xem payload của các points

### Bước 9: Test Edge Cases

**Empty File:**
- Upload PDF rỗng → Sẽ xử lý nhưng có thể extraction failed

**Corrupted PDF:**
- Upload PDF bị lỗi → Status: "✗ Lỗi"
- Error message hiển thị

**Network Error:**
- Ngắt mạng giữa chừng → Processing failed
- Document status: "failed"

**Concurrent Uploads:**
- Upload 10 files cùng lúc
- Tất cả được xử lý song song
- Socket.IO updates cho từng file riêng

### Bước 10: Kiểm tra Database

```powershell
cd server/prisma
# Mở SQLite DB
sqlite3 dev.db

# Query documents
SELECT id, documentName, processingStatus, chunksCount FROM documents;

# Query chunks
SELECT id, documentId, chunkType, embeddingStatus FROM document_chunks LIMIT 10;

# Exit
.quit
```

## 📊 Expected Results

### Successful Upload Flow:
```
User uploads PDF
  ↓
Backend saves to ./uploads/documents/
  ↓
Create Document record (status: processing)
  ↓
Upload to Gemini File API
  ↓
Extract structured content (JSON)
  ↓
Save metadata to Document
  ↓
Create chunks based on structure
  ↓
Generate embeddings (Google AI)
  ↓
Upload to Qdrant
  ↓
Update status: completed
  ↓
Real-time update to frontend via Socket.IO
```

### Database State:
- **documents** table: 1 row
- **document_chunks** table: N rows (depends on document structure)
- **Qdrant**: N vectors with metadata

### Files Created:
- `./uploads/documents/{timestamp}_{filename}.pdf`

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot find module '@qdrant/js-client-rest'"
**Solution:**
```powershell
cd server
npm install
```

### Issue 2: "Property 'document' does not exist on type 'PrismaClient'"
**Solution:**
```powershell
cd server
npm run prisma:generate
```

### Issue 3: "Failed to initialize Qdrant"
**Solution:**
- Check QDRANT_URL in .env
- Check QDRANT_API_KEY
- Test connection: https://cloud.qdrant.io

### Issue 4: "Failed to upload PDF to Gemini"
**Solution:**
- Check GEMINI_API_KEY
- Check file size < 50MB
- Check PDF not corrupted

### Issue 5: Socket.IO không update real-time
**Solution:**
- Check browser console for Socket.IO errors
- Check `socket.on('authenticate')` được gọi
- Refresh page

### Issue 6: Upload thành công nhưng không thấy file
**Solution:**
- Check `./uploads/documents/` folder exists
- Check permissions
- Check disk space

## ✅ Success Checklist

- [ ] Backend khởi động không lỗi
- [ ] Qdrant connection thành công
- [ ] Upload 1 PDF thành công
- [ ] Processing progress hiển thị real-time
- [ ] Document status: "completed"
- [ ] Chunks được tạo đúng số lượng
- [ ] Vectors được upload lên Qdrant
- [ ] Delete document thành công
- [ ] Upload nhiều files cùng lúc OK
- [ ] Error handling hoạt động

## 🎯 Next Steps

Sau khi test admin upload thành công:
1. Tạo User Chat Interface
2. Implement RAG Query endpoint
3. Test end-to-end chat với documents
4. Optimize embedding performance
5. Add caching layer

---

**Happy Testing! 🚀**

Nếu gặp lỗi, check:
1. Browser Console (F12)
2. Server Terminal logs
3. `.env` configuration
4. Network tab (API calls)
