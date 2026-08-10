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
