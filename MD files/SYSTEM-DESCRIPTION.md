# System Description & Route Map

Cap nhat luc: 2026-09-04 14:05:00 +07:00

Tai lieu nay mo ta kien truc va danh sach routes / endpoints hien huu cua he thong QuizzySmart, dong thoi ghi nhan cac contract giua Frontend va Backend.

## 1. Tong quan He thong
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS. Ho tro giao dien nguoi dung (luyen thi, lam de, AI camera search, quan ly ca nhan) va giao dien Admin Panel.
- **Backend**: Express + TypeScript + Prisma ORM (MySQL / SQLite) + Socket.IO + Qdrant Vector DB + Google Gemini API (trac nghiem, trich xuat van ban RAG, embeddings).

## 2. Route Map & Backend Endpoints

### 2.1. RAG Document Management (`/api/documents`)
- `POST /api/documents/upload`: Upload file PDF tai lieu vao collection Qdrant chi dinh.
  - Auth: Admin only (`requireAdmin`).
  - Request: `multipart/form-data` gom `documents` (file PDFs), `collectionName` (bat buoc).
  - Background process: `pdfProcessorService.processDocument` trich xuat noi dung, chunking va tao vector embeddings tren Qdrant.
- `GET /api/documents`: Danh sach tat ca van ban RAG da upload.
  - Auth: Admin only (`requireAdmin`).
  - Query params (tuy chon):
    - `collection`: Loc theo ten collection (hoac `__none__` cho van ban chua gan collection).
    - `status`: Loc theo trang thai (`completed`, `processing`, `failed`, hoac `all`).
    - `search`: Tim kiem theo tu khoa trong ten file, ten van ban, so hieu van ban, loai van ban.
  - Response contract:
    - `documents`: Danh sach van ban gom `{ id, fileName, documentName, documentNumber, documentType, uploadedAt, processingStatus, chunksCount, qdrantCollectionName }`.
    - `total`: Tong so van ban.
  - Ghi chu mismatch da xu ly: Truoc day endpoint thieu thuoc tinh `qdrantCollectionName` trong response khien Frontend khong nhan biet duoc van ban thuoc collection nao. Da duoc sua va dong bo tra ve day du `qdrantCollectionName`.
- `GET /api/documents/:id`: Chi tiet mot van ban RAG.
  - Auth: Admin only (`requireAdmin`).
  - Response contract: Chi tiet van ban bao gom cac truong metadata, markdownContent, chunks, processingStatus va `qdrantCollectionName`.
- `DELETE /api/documents/:id`: Xoa van ban va cac vector lien quan trong Qdrant.
  - Auth: Admin only (`requireAdmin`).
- `POST /api/documents/:id/re-extract`: Yeu cau Gemini trich xuat lai noi dung van ban.
- `POST /api/documents/:id/re-embed`: Yeu cau tinh toan va tao lai vector embeddings vao Qdrant.

### 2.2. Vector Collections (`/api/admin/collections`)
- `GET /api/admin/collections`: Danh sach cac collections trong Qdrant vector DB kem so luong vectors/points.
- `POST /api/admin/collections`: Tao moi collection vector voi dimension va khoang cach Cosine.
- `DELETE /api/admin/collections/:name`: Xoa collection khoi Qdrant.

### 2.3. Topics, Knowledge Bases & Tests with Topics
- `GET /api/topics`: Lay danh sach tat ca cac chu de trong he thong gom `{ id, name, description, createdAt }`.
- `POST /api/admin/topics`: Tao moi hoac upsert chu de (Admin only).
- `GET /api/bases`, `GET /api/admin/knowledge-bases`: Tra ve danh sach co so kien thuc co truong `topic`.
- `POST /api/bases`, `POST /api/admin/knowledge-bases`: Tiep nhan `topic` luu vao `KnowledgeBase` va tu dong upsert vao bang `Topic`.
- `GET /api/tests`, `GET /api/admin/tests`: Tra ve danh sach bai thi co truong `topic`.
- `POST /api/admin/tests`, `POST /api/admin/tests/batch`, `PUT /api/admin/tests/:id`: Tiep nhan `topic`, luu vao `Test` va upsert vao bang `Topic`.

### 2.4. Socket.IO Events
- Event `document:processing`: Ban tien do xu ly van ban RAG real-time `{ documentId, status, progress, currentStep, chunksCreated, chunksEmbedded, error }`.

## 3. Frontend Navigation & User Flows
- `AdminDashboard.tsx`:
  - `tests`: Quan ly bai thi (`components/admin/TestManagement.tsx`) - Ho tro tao de don / bo de batch gan chu de, loc theo chu de, badge chu de tren tung bai thi.
  - `knowledge`: Quan ly co so kien thuc (`components/admin/KnowledgeManagement.tsx`) - Ho tro tai len Excel gan chu de hoac tao chu de moi, loc theo chu de, badge chu de.
  - `documents`: Quan ly van ban RAG (`components/admin/DocumentManagement.tsx`) - Ho tro bo loc theo Collection, trang thai xu ly, tim kiem va thong ke.
  - `collections`: Quan ly Vector Collections (`components/admin/CollectionManagement.tsx`).
- `TestListScreen.tsx` (Man hinh thi cua nguoi dung):
  - Khi bai thi co chu de: nguoi dung duoc chon Chu de o Cap 1 (The chu de voi so luong bai thi con, tien do hoan thanh, diem cao nhat) -> vao Cap 2 xem cac bai thi con cua chu de do.
  - Cung cap Breadcrumb dieu huong quay lai danh sach chu de.
  - Ho tro chuyen doi che do xem ("Theo chu de" / "Tat ca bai thi") va thanh tim kiem tuc thi.
