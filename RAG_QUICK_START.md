# 🚀 RAG System - Quick Start

## Khởi động nhanh

### Option 1: Automatic Setup (Recommended)
```powershell
.\rag-setup.ps1
```

### Option 2: Manual Setup
```powershell
# 1. Install dependencies
cd server
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Create upload directories
mkdir -p uploads/documents

# 4. Check .env configuration
# Ensure QDRANT_URL, QDRANT_API_KEY, GEMINI_API_KEY are set
```

## Run the application

### Terminal 1: Backend
```powershell
cd server
npm run dev
```

### Terminal 2: Frontend
```powershell
npm run dev
```

## Access RAG Features

1. **Login as Admin**
2. **Navigate to Admin Dashboard**
3. **Click "📄 Quản lý Văn bản (RAG)"**
4. **Upload PDF files** (drag & drop or select)
5. **Watch real-time processing**

## Expected Console Output

### Backend startup:
```
[RAG] Initializing Qdrant service...
[Qdrant] Connection established successfully
[RAG] Qdrant service initialized successfully
API server on :3000
Socket.IO enabled for real-time updates
```

### During PDF processing:
```
[PDFProcessor] Starting processing for document xxx
[Gemini] Extracting content
[PDFProcessor] Created 15 chunks
[Gemini] Generated 15 embeddings
[Qdrant] Upserted 15 points
[PDFProcessor] Document processed successfully
```

## 📚 Full Documentation

- **Testing Guide**: `RAG_TESTING_GUIDE.md`
- **Qdrant Setup**: `QDRANT_SETUP_GUIDE.md`
- **Implementation Summary**: `RAG_IMPLEMENTATION_SUMMARY.md`

## 🐛 Troubleshooting

### Issue: "Cannot find module '@qdrant/js-client-rest'"
```powershell
cd server
npm install
```

### Issue: "Property 'document' does not exist"
```powershell
npx prisma generate
```

### Issue: "Failed to initialize Qdrant"
- Check `.env` file for QDRANT_URL and QDRANT_API_KEY
- Verify Qdrant Cloud credentials

## ✅ Quick Test Checklist

- [ ] Backend starts without errors
- [ ] Qdrant connection successful
- [ ] Can upload PDF
- [ ] Processing completes
- [ ] Document shows "✓ Hoàn thành"
- [ ] Real-time progress updates work

## 🎯 Features Implemented

✅ Admin can upload multiple PDFs (max 10, 50MB each)  
✅ Auto-extract document metadata (số, tên, loại, người ký, ngày)  
✅ Dynamic chunking based on document structure  
✅ Embedding generation (768 dimensions)  
✅ Vector storage in Qdrant Cloud  
✅ Real-time processing updates via Socket.IO  
✅ Document management (view, delete)  

## 🔜 Coming Next

- User Chat Interface
- RAG Query API
- Chat history
- Premium access control

---

**Ready to test!** 🎉
