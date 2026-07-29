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
