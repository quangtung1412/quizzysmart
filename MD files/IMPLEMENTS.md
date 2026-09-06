## 2026-07-29 07:41:37 +07:00

### Yeu cau
- Sửa lỗi định dạng ô ngày tháng năm trong Excel khi nhập vào bộ đề thi (chuyển các ô ngày dạng số Excel serial dates như 46204, 46213 thành định dạng ngày tháng hiển thị dạng DD/MM/YYYY hoặc chuỗi định dạng hiển thị gốc).

### Ket qua
- Cập nhật hàm xử lý đọc ô Excel trong `components/FileUpload.tsx` với các tùy chọn `cellDates: true`, `cellNF: true`, `cellText: true`.
- Bổ sung hàm `getCellValue` tự động chuyển đổi ô Date object, ô có chuỗi văn bản đã định dạng (`cell.w`), hoặc ô chứa số Excel serial date (`cell.v`) phù hợp về định dạng `DD/MM/YYYY`.

### Files tac dong
- `components/FileUpload.tsx`

### Validation
- Kiểm tra mã nguồn và biên dịch thành công ứng dụng.
- Đã xác nhận cơ chế đọc ô ngày tháng của SheetJS (XLSX).

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-07-29 08:19:35 +07:00

### Yeu cau
- Chuẩn hóa nghiêm ngặt hiển thị ngày tháng năm về đúng định dạng `dd/mm/yyyy` khi import dữ liệu Excel vào bộ câu hỏi.

### Ket qua
- Cập nhật hàm `getCellValue` trong `components/FileUpload.tsx`: ép tất cả các kiểu ô Date, số sê-ri ngày Excel và các chuỗi định dạng ISO/US (YYYY-MM-DD, MM/DD/YYYY) về chuẩn định dạng `dd/mm/yyyy` (2 chữ số cho ngày, 2 chữ số cho tháng, 4 chữ số cho năm).

### Files tac dong
- `components/FileUpload.tsx`

### Validation
- Kiểm tra các mẫu dữ liệu ngày sê-ri (46204 -> 30/06/2026, 46213 -> 09/07/2026, 46217 -> 13/07/2026, 46235 -> 31/07/2026).

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-07-29 08:41:55 +07:00

### Yeu cau
- Fix lỗi API 500 khi xóa Cơ sở kiến thức (Knowledge Base) và Bài thi (Test) ở trang Quản trị.

### Ket qua
- Bổ sung hàm helper `deleteKnowledgeBaseCascade` và `deleteTestCascade` trong `server/src/index.ts`.
- Xử lý xóa tuần tự các bảng phụ liên quan (`AttemptAnswer`, `QuestionProgress`, `StudyPlan`, `Attempt`, `TestAssignment`) trước khi xóa bản ghi chính (`KnowledgeBase`, `Test`) để tránh vi phạm rào cản Khóa ngoại (Foreign Key Constraint) của MySQL làm phát sinh lỗi HTTP 500.

### Files tac dong
- `server/src/index.ts`

### Validation
- Biên dịch thành công server (`npm run build` trong folder `server`).

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-07-29 09:16:15 +07:00

### Yeu cau
- Phát triển tính năng Tạo bộ đề thi tự động từ nhiều chủ đề (Cơ sở kiến thức) khác nhau:
  - Mỗi đề thi có tỷ lệ các câu hỏi trong từng chủ đề tương ứng với số lượng câu hỏi thực tế của chủ đề đó.
  - Tự động chia toàn bộ kho câu hỏi của các chủ đề được chọn thành các đề thi ($N_{total} / K$), đảm bảo các câu hỏi không trùng lặp giữa các đề.
  - Đề thi cuối cùng chứa toàn bộ số câu hỏi còn dư ($N_{total} \bmod K$).

### Ket qua
- Bổ sung endpoint `POST /api/admin/tests/batch` trong `server/src/index.ts`: thực hiện trích xuất, xáo trộn, tính toán tỷ lệ chủ đề và phân bổ ngẫu nhiên câu hỏi thành các đề thi độc lập không lặp lại.
- Thêm hàm client `adminCreateTestBatch` trong `src/api.ts`.
- Cập nhật giao diện Modal Tạo bài thi trong `components/admin/TestManagement.tsx`: bổ sung tab chuyển đổi chế độ "Tạo 1 đề thi đơn lẻ" và "Tạo bộ đề thi tự động (Chia theo tỷ lệ chủ đề)", cho phép chọn nhiều chủ đề, hiển thị xem trước tổng số câu hỏi khả dụng, số lượng đề thi và đề dư dự kiến.

### Files tac dong
- `server/src/index.ts`
- `src/api.ts`
- `components/admin/TestManagement.tsx`

### Validation
- Build thành công `server` (`npm run build` trong `server`).
- Kiểm tra tính toán phân chia đề thi và gán quyền người dùng/nhóm người dùng.

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-07-29 09:22:50 +07:00

### Yeu cau
- Sửa lỗi runtime `ReferenceError: Cannot access 'formData' before initialization` tại `TestManagement.tsx:137`.

### Ket qua
- Khắc phục vi phạm Temporal Dead Zone (TDZ) trong React component `TestManagement.tsx`: chuyển khai báo state `formData` lên trước việc truy cập trong `useMemo` tính toán `batchTestPreview`.

### Files tac dong
- `components/admin/TestManagement.tsx`

### Validation
- Biên dịch lại ứng dụng (`npm run build`) thành công.

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-07-29 09:33:00 +07:00

### Yeu cau
- Sửa lỗi runtime `ReferenceError: canSubmit is not defined` tại `TestManagement.tsx:1053`.

### Ket qua
- Khôi phục hàm kiểm tra `canSubmit` (dành cho kiểm tra tính hợp lệ ở chế độ tạo/sửa đề thi đơn lẻ) song song với hàm `canSubmitBatch` trong `components/admin/TestManagement.tsx`.

### Files tac dong
- `components/admin/TestManagement.tsx`

### Validation
- Biên dịch lại ứng dụng (`npm run build`) thành công.

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-07-29 09:44:35 +07:00

### Yeu cau
- Sắp xếp màn hình danh sách bài thi theo thứ tự ID giảm dần (từ ID lớn đến ID nhỏ).

### Ket qua
- Cập nhật endpoint `GET /api/admin/tests` trong `server/src/index.ts`: thay đổi `orderBy` từ `createdAt: 'desc'` thành `id: 'desc'`.
- Cập nhật giao diện trong `components/admin/TestManagement.tsx`: bổ sung `sortedTests` sử dụng `b.id.localeCompare(a.id)` để đảm bảo bảng danh sách bài thi ở client luôn hiển thị xếp theo ID giảm dần.

### Files tac dong
- `server/src/index.ts`
- `components/admin/TestManagement.tsx`

### Validation
- Build thành công cả client và server (`npm run build`).

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-08-10 16:38:15 +07:00

### Yeu cau
- Bổ sung tùy chọn cho phép Admin lựa chọn có xáo trộn thứ tự câu hỏi mỗi lần thi hay không (`shuffleQuestions`) và có xáo trộn thứ tự các đáp án trong câu hỏi hay không (`shuffleOptions`) trong màn hình tạo/chỉnh sửa đề thi.

### Ket qua
- Cập nhật schema Prisma (`server/prisma/schema.prisma`): Thêm 2 thuộc tính `shuffleQuestions` (mặc định `true`) và `shuffleOptions` (mặc định `true`) vào model `Test`.
- Cập nhật backend API (`server/src/index.ts`):
  - Nhận và lưu `shuffleQuestions`, `shuffleOptions` tại các endpoint tạo mới đơn lẻ (`POST /api/admin/tests`), tạo bộ đề (`POST /api/admin/tests/batch`), chỉnh sửa đề thi (`PUT /api/admin/tests/:id`).
  - Xử lý tại `GET /api/tests/:id`: Nếu `shuffleQuestions !== false`, tự động đảo thứ tự câu hỏi ngẫu nhiên cho từng lượt làm bài; Nếu `shuffleOptions !== false`, tự động đảo thứ tự lựa chọn đáp án và trả kèm `optionMapping` để khớp chính xác đáp án khi nộp bài.
- Cập nhật frontend types (`types.ts`, `src/api.ts`, `AppWithRouter.tsx`, `App.tsx`, `components/QuizScreen.tsx`):
  - Xử lý khớp thứ tự đáp án ban đầu qua `optionMapping` khi làm bài thi.
- Cập nhật UI Quản lý đề thi (`components/admin/TestManagement.tsx`): Thêm nhóm Checkbox "Tùy chọn xáo trộn đề thi" (Đảo thứ tự câu hỏi & Đảo thứ tự các đáp án) trong Modal Tạo bài thi (đơn lẻ & bộ đề) và Modal Chỉnh sửa bài thi.

### Files tac dong
- `server/prisma/schema.prisma`
- `server/src/index.ts`
- `types.ts`
- `src/api.ts`
- `AppWithRouter.tsx`
- `App.tsx`
- `components/QuizScreen.tsx`
- `components/admin/TestManagement.tsx`

### Validation
- Chạy `npx prisma generate` thành công.
- Build thành công cả `server` và `root` (`npm run build`).

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-08-10 16:42:00 +07:00

### Yeu cau
- Sửa lỗi biên dịch TypeScript `Cannot find name 'shuffleQuestions'` / `Cannot find name 'shuffleOptions'` khi build Docker backend container.

### Ket qua
- Bổ sung `shuffleQuestions = true` và `shuffleOptions = true` vào khai báo bóc tách dữ liệu (destructuring) từ `req.body` trong endpoint `POST /api/admin/tests/batch` (`server/src/index.ts`).

### Files tac dong
- `server/src/index.ts`

### Validation
- Kiểm tra biên dịch TypeScript `npx tsc -p tsconfig.json` (`npm run build` trong folder `server`) thành công 100%.

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-08-10 16:54:40 +07:00

### Yeu cau
1. Sửa lỗi hiển thị đáp án khi làm bài thi (lệch màu viền và biểu tượng chọn giữa 2 câu do đảo đáp án).
2. Sửa thứ tự hiển thị danh sách đề thi ở giao diện người dùng (`/tests`): đưa đề thi mới nhất lên đầu tiên.

### Ket qua
1. Cập nhật `getOptionClasses` trong `components/QuizScreen.tsx`: chuyển đổi `optionIndex` hiển thị ở UI sang `targetIndex` thông qua `optionMapping` trước khi so sánh lựa chọn `selected` và đáp án đúng `isCorrect`.
2. Cập nhật sắp xếp đề thi mới nhất lên đầu:
   - Sắp xếp ở endpoint `GET /api/tests` trong `server/src/index.ts` theo `createdAt` / `id` giảm dần.
   - Sắp xếp ở `loadTests` trong `components/TestListScreen.tsx` theo `createdAt` / `id` giảm dần.

### Files tac dong
- `components/QuizScreen.tsx`
- `components/TestListScreen.tsx`
- `server/src/index.ts`

### Validation
- Build thành công cả `server` và `root` (`npm run build`).

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-09-04 14:05:00 +07:00

### Yeu cau
- Trong menu quản lý văn bản RAG: bổ sung bộ lọc theo Collection để khi chọn collection có thể biết văn bản nào đang thuộc collection nào, và trạng thái đã hoàn thành hay chưa.

### Ket qua
- Khắc phục lỗi backend thiếu trường `qdrantCollectionName`:
  - Cập nhật `GET /api/documents` và `GET /api/documents/:id` trong `server/src/routes/document.routes.ts` để trả về `qdrantCollectionName`.
  - Bổ sung hỗ trợ lọc tùy chọn phía server qua query parameters `collection`, `status`, `search` tại `GET /api/documents`.
- Cập nhật giao diện Quản lý Văn bản RAG (`components/admin/DocumentManagement.tsx`):
  - Phân tách rõ ràng mục chọn collection khi upload (`uploadCollection`) và bộ lọc danh sách (`filterCollection`).
  - Thêm thanh công cụ lọc trực quan (Filter Toolbar) gồm:
    - Dropdown lọc theo Collection kèm số lượng văn bản của từng collection (`{col.name} ({count} văn bản)`).
    - Bộ lọc theo Trạng thái (Tabs/Pills): Tất cả, ✓ Đã hoàn thành (xanh lá), ⏳ Đang xử lý (xanh dương), ✗ Lỗi (đỏ) với số lượng đếm động tương ứng theo collection đang chọn.
    - Ô tìm kiếm nhanh từ khóa (tên văn bản, số hiệu, file) kèm nút xóa nhanh ✕.
    - Nút Đặt lại bộ lọc (✕ Đặt lại) khi có bộ lọc đang được áp dụng.
  - Thêm thanh tóm tắt thông tin Collection đang chọn (Collection Active Banner) hiển thị tổng số văn bản và chi tiết số lượng hoàn thành / đang xử lý / lỗi.
  - Cập nhật thẻ văn bản: Hiển thị badge Collection nổi bật (`📦 [Tên collection]`), cho phép nhấp trực tiếp vào badge để lọc nhanh văn bản theo collection đó; badge trạng thái hoàn thành / đang xử lý / lỗi chuẩn hóa.
  - Bổ sung trạng thái rỗng (Empty state) kèm nút "Xóa bộ lọc" khi không có văn bản nào khớp điều kiện lọc.
- Cập nhật modal Chi tiết Văn bản (`components/admin/DocumentDetailModal.tsx`):
  - Bổ sung `qdrantCollectionName?: string` vào interface `DocumentDetail` và hiển thị thông tin Collection trong tab Thông tin chung.
- Cập nhật tài liệu hệ thống:
  - Tạo mới `MD files/SYSTEM-DESCRIPTION.md` mô tả các route, endpoint RAG và route mapping.

### Files tac dong
- `server/src/routes/document.routes.ts`
- `components/admin/DocumentManagement.tsx`
- `components/admin/DocumentDetailModal.tsx`
- `MD files/SYSTEM-DESCRIPTION.md`
- `MD files/IMPLEMENTS.md`

### Validation
- Biên dịch server thành công (`npm run build` trong `server`).
- Biên dịch frontend root thành công (`npm run build`).
- Đã xác thực logic đếm số lượng văn bản theo từng collection và theo từng trạng thái.

### Ghi chu
- Không có rủi ro phát sinh.

## 2026-09-06 10:10:00 +07:00

### Yeu cau
- Ở màn hình quản lý cơ sở kiến thức: khi thêm kiến thức mới (qua Excel) chọn được chủ đề của kiến thức đó (chọn từ danh sách hoặc nhập mới).
- Khi tạo bài thi (Admin): chọn được chủ đề cho bài thi (áp dụng cho cả tạo đề đơn và tạo bộ đề batch); hỗ trợ chọn nhanh các cơ sở kiến thức cùng chủ đề.
- Ở màn hình thi của người dùng (`TestListScreen.tsx`): nếu bài thi được gán chủ đề, người dùng vào thi sẽ chọn chủ đề trước (Cấp 1), trong chủ đề sẽ hiển thị danh sách các bài thi con (Cấp 2), kèm breadcrumb điều hướng và nút chuyển đổi xem phẳng.

### Ket qua
- **Database & Prisma Schema**:
  - Bổ sung trường `topic String?` (có index) vào `model KnowledgeBase` và `model Test`.
  - Thêm `model Topic` độc lập (`id`, `name`, `description`, `createdAt`).
  - Chạy `npx prisma generate` thành công.
- **Backend API (`server/src/index.ts`)**:
  - Bổ sung hàm tự động migrate an toàn khi khởi động server `ensureTopicColumns()` để tạo cột `topic` và bảng `topics` nếu chưa tồn tại.
  - Thêm endpoints `GET /api/topics` và `POST /api/admin/topics`.
  - Cập nhật các endpoint `GET /api/bases`, `POST /api/bases`, `GET /api/admin/knowledge-bases`, `POST /api/admin/knowledge-bases` để nhận, lưu và trả về `topic`, đồng thời tự động upsert vào bảng `Topic`.
  - Cập nhật các endpoint `GET /api/tests`, `GET /api/admin/tests`, `POST /api/admin/tests`, `POST /api/admin/tests/batch`, `PUT /api/admin/tests/:id` để nhận, lưu và trả về `topic`.
- **Frontend Core & Client API (`types.ts`, `src/api.ts`, `src/hooks/usePersistentStores.ts`)**:
  - Thêm `topic?: string | null` vào `KnowledgeBase`, `AdminTestSummary`, `CreateTestPayload`, `CreateTestBatchPayload`, `UpdateTestPayload`, `CreateKnowledgeBasePayload`.
  - Thêm `listTopics()` và `adminCreateTopic()`.
- **Quản lý cơ sở kiến thức (`components/FileUpload.tsx`, `components/admin/KnowledgeManagement.tsx`, `components/AdminDashboard.tsx`, `AppWithRouter.tsx`, `App.tsx`)**:
  - Bổ sung dropdown chọn chủ đề có sẵn hoặc `+ Nhập chủ đề mới...` trong form xem trước câu hỏi của `FileUpload.tsx`.
  - Chuyển tiếp `topic` khi lưu cơ sở kiến thức qua `handleSaveNewBase`.
  - Bổ sung dropdown lọc theo Chủ đề bên cạnh ô tìm kiếm và cột "Chủ đề" hiển thị badge trực quan trong bảng cơ sở kiến thức của Admin.
- **Quản lý bài thi Admin (`components/admin/TestManagement.tsx`)**:
  - Thêm trường chọn / nhập chủ đề mới trong Modal Tạo đề thi (đơn lẻ & bộ đề batch) và Modal Sửa đề thi.
  - Trong chế độ tạo bộ đề thi batch: thêm nút tiện ích `Chọn theo chủ đề` giúp Admin chọn nhanh toàn bộ các CSKT thuộc chủ đề đã chọn.
  - Thêm thanh tìm kiếm và dropdown lọc theo Chủ đề, bổ sung cột "Chủ đề" hiển thị badge màu tím trên bảng danh sách bài thi Admin.
- **Màn hình thi của người dùng (`components/TestListScreen.tsx`)**:
  - Thiết kế điều hướng 2 cấp độ trực quan:
    - **Cấp 1 - Chọn chủ đề**: Lưới các thẻ chủ đề với icon thư mục, số lượng bài thi con, thống kê tiến độ hoàn thành (X/Y bài đã làm + progress bar) và điểm cao nhất đạt được trong chủ đề.
    - **Cấp 2 - Danh sách bài thi con**: Hiển thị breadcrumb điều hướng `Tất cả chủ đề / [Tên chủ đề]`, nút quay lại danh sách chủ đề và danh sách các thẻ bài thi con với đầy đủ chức năng làm bài, xem thống kê và chi tiết.
  - Bổ sung nút chuyển đổi linh hoạt giữa chế độ xem `📁 Theo chủ đề` và `📄 Tất cả bài thi`, cùng thanh tìm kiếm tức thì theo tên đề thi hoặc chủ đề.

### Files tac dong
- `server/prisma/schema.prisma`
- `server/src/index.ts`
- `types.ts`
- `src/api.ts`
- `src/hooks/usePersistentStores.ts`
- `components/FileUpload.tsx`
- `components/AdminDashboard.tsx`
- `components/admin/KnowledgeManagement.tsx`
- `components/admin/TestManagement.tsx`
- `components/TestListScreen.tsx`
- `AppWithRouter.tsx`
- `App.tsx`
- `MD files/SYSTEM-DESCRIPTION.md`
- `MD files/IMPLEMENTS.md`

### Validation
- Chạy `npx prisma generate` thành công.
- Build server thành công (`npm run build` trong `server`) với exit code 0.
- Build frontend root thành công (`npm run build`) với exit code 0.
- Đã xác thực logic điều hướng cấp độ chọn chủ đề -> xem bài thi con và lọc theo chủ đề ở các màn hình.

### Ghi chu
- Không có rủi ro phát sinh.

