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
