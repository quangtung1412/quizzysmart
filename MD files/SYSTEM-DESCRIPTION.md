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
- `DELETE /api/documents/:id`: Xoa van ban, file vat ly va toan bo vector points lien quan trong Qdrant (ho tro tim va xoa theo ca danh sach point IDs lan payload filter tren collection cua van ban, collection mac dinh va toan bo cac collection khac trong cluster).
  - Auth: Admin only (`requireAdmin`).
- `POST /api/documents/batch-delete`: Xoa cung luc nhieu van ban RAG, toan bo vector points tuong ung trong Qdrant va file vat ly tren disk.
  - Auth: Admin only (`requireAdmin`).
  - Request: JSON `{ ids: string[] }`.
  - Response: `{ success: true, count: number, message: string }`.
- `POST /api/documents/cleanup-orphans`: Quet tat ca collections trong Qdrant bang scroll va xoa sach cac vector points mo coi (cac point co documentId khong con ton tai trong DB).
  - Auth: Admin only (`requireAdmin`).
  - Response: `{ success: true, totalDeleted: number, details: Array<{ collection: string, deletedCount: number }> }`.
- `POST /api/documents/:id/re-extract`: Yeu cau Gemini trich xuat lai noi dung van ban.
- `POST /api/documents/:id/re-embed`: Yeu cau tinh toan va tao lai vector embeddings vao Qdrant.

### 2.2. Vector Collections (`/api/admin/collections`)
- `GET /api/admin/collections`: Danh sach cac collections trong Qdrant vector DB kem so luong vectors/points.
- `POST /api/admin/collections`: Tao moi collection vector voi dimension va khoang cach Cosine.
- `DELETE /api/admin/collections/:name`: Xoa collection khoi Qdrant.
- `POST /api/admin/collections/cleanup-orphans`: Quet va don dep tat ca vector points mo coi tren moi collection trong Qdrant cluster.
  - Auth: Admin only (`requireAdmin`).

### 2.3. Topics, Knowledge Bases & Tests with Topics
- `GET /api/topics`: Lay danh sach tat ca cac chu de trong he thong gom `{ id, name, description, createdAt }`.
- `POST /api/admin/topics`: Tao moi hoac upsert chu de (Admin only).
- `GET /api/bases`, `GET /api/admin/knowledge-bases`: Tra ve danh sach co so kien thuc co truong `topic`.
- `POST /api/bases`, `POST /api/admin/knowledge-bases`: Tiep nhan `topic` luu vao `KnowledgeBase` va tu dong upsert vao bang `Topic`.
- `POST /api/admin/knowledge-bases/batch-topic`: Gan chu de hang loat cho nhieu co so kien thuc (`{ baseIds: string[], topic: string | null }`).
- `GET /api/tests`, `GET /api/admin/tests`: Tra ve danh sach bai thi co truong `topic`.
- `POST /api/admin/tests`, `POST /api/admin/tests/batch`, `PUT /api/admin/tests/:id`: Tiep nhan `topic`, luu vao `Test` va upsert vao bang `Topic`.
- `POST /api/admin/tests/batch-topic`: Gan chu de hang loat cho nhieu bai thi (`{ testIds: string[], topic: string | null }`).

### 2.4. Socket.IO Events
- Event `document:processing`: Ban tien do xu ly van ban RAG real-time `{ documentId, status, progress, currentStep, chunksCreated, chunksEmbedded, error }`.

### 2.5. AI Camera & Image Search (`/api/premium/search-by-image`, `/api/premium/search-by-image-stream`)
- `POST /api/premium/search-by-image` & `POST /api/premium/search-by-image-stream`:
  - Trich xuat cau hoi va cac phuong an tu anh chup (OCR/Gemini Vision), tim kiem cau hoi tuong dong trong ngan hang trac nghiem hoac truy van RAG.
  - Thuat toan so khop cau hoi 2 tang sieu toc (Two-Stage Matching Architecture) giai quyet triet de diem nghen 12.5s tren 11,000 cau hoi:
    - **In-Memory Question Cache (`questionCacheService`)**: Cache toan bo cau hoi theo `baseId` trong RAM, tien xu ly truoc 1 lan duy nhat (chuoi chuan hoa khong dau, tap tu khoa `tokenSet`, tap cac con so `numbers`, mảng `parsedOptions`). Loai bo hoan toan thoi gian Prisma query va JSON.parse 11,000 lan o moi request. Tu dong invalidate cache khi Admin them/sua/xoa cau hoi hoac import Excel.
    - **Tang 1 - Loc tho ung vien sieu toc (Fast Candidate Pre-filtering)**: Su dung Token Overlap (Set intersection qua `Set.has()`) va Number Verification quet nhanh qua toan bo 11,000 cau trong 1-2ms, rut gon danh sach xuong Top 60 cau ung vien tiem nang nhat (loai bo 99.5% cau khong lien quan).
    - **Tang 2 - So khop chi tiet (Fine-grained Scoring)**: Chi chay tren Top 60 ung vien. Thuat toan `computeLevenshtein` duoc toi uu dung 2 mang phang `Int32Array` (zero heap allocation, khong gay rac cho V8 Garbage Collector). Chi tinh toan so khop options khi diem so bo cau hoi dat nguong $\ge 0.25$.
    - Tong thoi gian so khop `dbMatchMs` giam tu 12.54s xuong duoi 18ms (nhanh gap ~700 lan).
  - Thuat toan can chinh dap an `alignOptions`:
    - Clean prefix loai bo ky tu dau dong (A., B., 1., a)...).
    - Strict Number Check (neu so khac nhau thi similarity = 0).
    - Rut gon dap an theo anh chup: Chi giu lai dung cac slot phuong an thuc te co tren anh (vi du: anh co 3 dap an thi chi hien thi A, B, C; khong chen them dap an tu DB de du 4). Chi fallback hien thi du phuong an tu DB khi anh chup khong co bat ky phuong an nao (validExtractedCount === 0).
    - Global Best-Pair Matching: Sap xep cac cap do tuong dong giam dan truoc khi ghep, tranh loi tham lam theo slot gay cuop slot dung.
    - Safety Verification: Dam bao dap an dung trong DB luon duoc anh xa chinh xac 100% vao dung slot phuong an tuong ung tren anh. Khong tu tien gan dap an dung vao slot cuoi cung neu dap an dung khong xuat hien tren anh.
  - Payload contract khi tim thay cau hoi trac nghiem (`matchedQuestion` & `alternativeMatches`):
    - `question`: Luon uu tien tuyet doi cau hoi trich xuat tu anh chup nguoi dung (`recognizedText`), fallback sang cau hoi trong DB chi khi anh hoan toan khong co chu.
    - `dbQuestion`: Cau hoi goc luu trong ngan hang de trac nghiem de luu tru doi chieu khi can.
    - `recognizedQuestion`: Cau hoi trich xuat tu anh chup cua nguoi dung.
    - `options`: Danh sach noi dung phuong an da can chinh va rut gon theo dung cac slot tren anh chup.
    - `dbOptions`: Danh sach phuong an goc trong ngan hang de.
    - `imageOptions`: Mang doi tuong rut gon theo cac slot co tren anh `{ slot: 'A'|'B'|'C'|'D', text: string, dbText?: string, isCorrect: boolean, matchScore: number, slotIndex: number }`.
    - `imageCorrectAnswerSlots`: Danh sach slot dap an dung tren anh chup (vi du: `['A']` hoac `['B']`).
    - `accuracy`: Ti le khop da duoc chuan hoa clamp ve doan [0, 100]%.
    - `timeline`: Thong so thoi gian chi tiet cua tung cong doan:
      - `serverAuthMs`: Thoi gian xac thuc token, kiem tra quota va chon model.
      - `visionOcrMs`: Thoi gian goi API Gemini Vision OCR va parse JSON cau hoi/dap an.
      - `dbQueryMs`: Thoi gian truy van lay toan bo cau hoi trong DB theo knowledge bases.
      - `dbMatchMs`: Thoi gian chay thuat toan tinh toan so khop Levenshtein + Jaccard va can chinh dap an `alignOptions`.
      - `ragEmbeddingMs`: Thoi gian tao embedding cho cau hoi (neu bat RAG).
      - `ragVectorSearchMs`: Thoi gian tim kiem doan van ban trong Qdrant (neu bat RAG).
      - `ragAnswerMs`: Thoi gian Gemini sinh cau tra loi tu van ban RAG (neu bat RAG).
      - `serverTotalMs`: Tong thoi gian xu ly tai server backend.
      - `clientCaptureMs`: Thoi gian client chup anh tu webcam/video sang canvas base64.
      - `networkTransferMs`: Thoi gian truyen tai mang hai chieu (client -> server -> client).
      - `clientTotalMs`: Tong thoi gian tinh tu luc bam chup den khi hien thi ket qua tren giao dien.

## 3. Frontend Navigation & User Flows
- `LiveCameraSearch.tsx` & `ImageSearchScreen.tsx`:
  - Khi camera / anh chup khop voi cau hoi trac nghiem trong DB:
    - Hien thi cau hoi va cac phuong an dang van ban chuan (plain text), bo hoan toan mau sac highlight diff vang/do de tranh roi mat.
    - Phuong an dung duoc lam noi bat voi mau xanh la (border xanh, badge checkmark ✓ "Dap an dung"), phuong an sai hien thi nhe nhang.
    - Dam bao vi tri dau tich ✓ dap an dung phan anh chinh xac 100% dap an dung cua cau hoi trong ngan hang de.
  - Hiển thị Timeline chi tiết từng công đoạn cho Admin (`SearchTimelineView`):
    - Khi người dùng là Quản trị viên (`user?.role === 'admin'`) và có `searchResult.timeline`, hiển thị bảng phân tích timeline chi tiết gồm:
      - Badge đánh giá tốc độ: ⚡ Nhanh (< 2.5s), ⏱️ Trung bình (2.5s - 5s), ⚠️ Chậm (> 5s).
      - Thanh phân bổ thời gian trực quan (stacked progress bar) thể hiện tỷ lệ % thời gian của từng khâu: Client Capture, Network Transfer, Server Auth & Prep, Gemini Vision OCR, DB Query, DB Matching, RAG.
      - Cảnh báo điểm nghẽn chính (Bottleneck Banner) tự động phát hiện khâu chiếm nhiều thời gian nhất.
      - Chi tiết từng bước đo được tính bằng ms và % trên tổng thời gian.
      - Hiển thị model Gemini Vision thực tế đã sử dụng (`searchResult.modelUsed`).
    - Đối với người dùng thông thường (`user?.role !== 'admin'`), timeline được ẩn hoàn toàn để đảm bảo giao diện gọn gàng, tập trung.
- `AdminDashboard.tsx`:
  - `tests`: Quan ly bai thi (`components/admin/TestManagement.tsx`) - Ho tro tao de don / bo de batch gan chu de, loc theo chu de, badge chu de tren tung bai thi. Ho tro checkbox chon nhieu bai thi va gan chu de hang loat (`POST /api/admin/tests/batch-topic`).
  - `knowledge`: Quan ly co so kien thuc (`components/admin/KnowledgeManagement.tsx`) - Ho tro tai len Excel gan chu de hoac tao chu de moi, loc theo chu de, badge chu de. Ho tro checkbox chon nhieu co so kien thuc va gan chu de hang loat (`POST /api/admin/knowledge-bases/batch-topic`).
  - `documents`: Quan ly van ban RAG (`components/admin/DocumentManagement.tsx`) - Ho tro bo loc theo Collection, trang thai xu ly, tim kiem va thong ke. Ho tro checkbox chon tung van ban / chon tat ca va xoa hang loat cung luc (`POST /api/documents/batch-delete`). Cung cap nut "🧹 Don dep vector rac" goi `POST /api/documents/cleanup-orphans` de quet va xoa toan bo vector mo coi trong Qdrant.
  - `collections`: Quan ly Vector Collections (`components/admin/CollectionManagement.tsx`) - Ho tro xem thong so collection, tao moi, xoa collection va nut "🧹 Don dep vector rac" goi `POST /api/admin/collections/cleanup-orphans`.
- `KnowledgeBaseScreen.tsx` (Man hinh on luyen cua nguoi dung):
  - Khi co so kien thuc co chu de: nguoi dung duoc chon Chu de o Cap 1 (The chu de voi so luong bai on tap con, tong so cau hoi) -> vao Cap 2 xem cac bai on tap con cua chu de do.
  - Cung cap Breadcrumb dieu huong quay lai danh sach chu de.
  - Ho tro nut bat/tat chuyen doi che do xem ("Theo chu de" / "Tat ca bai on") va thanh tim kiem tuc thi theo ten bai hoc / chu de.
  - Cung cap nut truc tiep: "🎯 On tap bai nay" (`onSelect`) va "📅 Ke hoach hoc tap" (`onViewStudyPlan`).
- `TestListScreen.tsx` (Man hinh thi cua nguoi dung):
  - Khi bai thi co chu de: nguoi dung duoc chon Chu de o Cap 1 (The chu de voi so luong bai thi con, tien do hoan thanh, diem cao nhat) -> vao Cap 2 xem cac bai thi con cua chu de do.
  - Cung cap Breadcrumb dieu huong quay lai danh sach chu de.
  - Ho tro chuyen doi che do xem ("Theo chu de" / "Tat ca bai thi") va thanh tim kiem tuc thi.

