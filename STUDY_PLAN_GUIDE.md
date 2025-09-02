# Lộ trình ôn tập cá nhân hóa - Hướng dẫn sử dụng

## Tổng quan
Hệ thống "Lộ trình ôn tập cá nhân hóa" là một tính năng thông minh giúp người dùng học tập một cách khoa học và hiệu quả. Hệ thống sử dụng phương pháp lặp lại ngắt quãng (Spaced Repetition) để tối ưu hóa việc ghi nhớ kiến thức.

## Cách thức hoạt động

### 1. Thiết lập lộ trình
- Người dùng chọn "🎯 Tạo lộ trình ôn tập" cho bất kỳ bộ câu hỏi nào
- Nhập thông tin:
  - **Thời gian ôn tập**: Số ngày muốn hoàn thành việc học (ví dụ: 30 ngày)
  - **Thời gian học mỗi ngày**: Số phút có thể dành ra hàng ngày (ví dụ: 60 phút)
- Hệ thống tự động tính toán số câu hỏi cần học mỗi ngày

### 2. Giai đoạn 1: Học tất cả câu hỏi
- Mỗi ngày, hệ thống hiển thị các câu hỏi cần học
- Sau khi trả lời, người dùng đánh giá độ khó:
  - **😊 Dễ**: Đã hiểu rõ
  - **🤔 Trung bình**: Cần xem lại
  - **😰 Khó**: Chưa nắm vững

#### Thuật toán ưu tiên câu hỏi:
- **Câu hỏi "Khó"**: Xuất hiện lại hàng ngày
- **Câu hỏi "Trung bình"**: Xuất hiện lại sau 2-7 ngày
- **Câu hỏi "Dễ"**: Xuất hiện lại sau thời gian dài (7-30 ngày)

### 3. Giai đoạn 2: Thi thử tổng hợp
- Kích hoạt khi tất cả câu hỏi được đánh giá "Dễ"
- Tạo các bài thi thử với câu hỏi ngẫu nhiên từ toàn bộ bộ đề
- Giúp người dùng làm quen với môi trường thi thật

## Tính năng chính

### 📊 Theo dõi tiến độ
- Biểu đồ tiến độ tổng thể
- Thống kê câu hỏi theo độ khó
- Theo dõi số ngày đã học và còn lại

### 🎯 Học tập thích ứng
- Ưu tiên câu hỏi khó
- Điều chỉnh tần suất xuất hiện dựa trên đánh giá
- Cho phép đánh giá lại câu hỏi

### 📈 Phân tích thông minh
- Dự đoán thời gian hoàn thành
- Tính toán khối lượng học tập hàng ngày
- Đề xuất lịch trình tối ưu

## Giao diện người dùng

### Màn hình thiết lập
- Form nhập thông tin học tập
- Preview lộ trình dự kiến
- Giải thích cách thức hoạt động

### Màn hình tổng quan
- Hiển thị tiến độ và thống kê
- Nút "Bắt đầu học hôm nay"
- Chuyển đổi giai đoạn tự động

### Màn hình học hàng ngày
- Hiển thị câu hỏi với options
- Cho phép đánh giá độ khó
- Thanh tiến độ ngày

### Màn hình thi thử (Giai đoạn 2)
- Bài thi tổng hợp
- Môi trường giống thi thật
- Đánh giá tổng thể

## Công nghệ sử dụng

### Frontend Components
- `StudyPlanSetupScreen.tsx`: Thiết lập lộ trình
- `StudyPlanOverviewScreen.tsx`: Tổng quan tiến độ
- `DailyStudyScreen.tsx`: Học hàng ngày
- `ModeSelectionScreen.tsx`: Chọn chế độ học tập

### Data Management
- `useStudyPlanStore.ts`: Quản lý state và logic
- LocalStorage để lưu trữ dữ liệu
- TypeScript interfaces đầy đủ

### Thuật toán
```typescript
// Tính toán ngày review tiếp theo
const calculateNextReviewDate = (difficulty: DifficultyLevel, reviewCount: number) => {
  switch (difficulty) {
    case 'hard': return 1 day;        // Hàng ngày
    case 'medium': return 2-7 days;   // Tăng dần
    case 'easy': return 7-30 days;    // Khoảng cách lớn
  }
}
```

## Lợi ích

### Cho người học
- **Tối ưu thời gian**: Tập trung vào câu hỏi khó
- **Ghi nhớ lâu dài**: Phương pháp lặp lại khoa học
- **Động lực học tập**: Theo dõi tiến độ rõ ràng
- **Linh hoạt**: Tùy chỉnh theo khả năng cá nhân

### Cho giảng viên
- **Giám sát tiến độ**: Theo dõi học tập của học viên
- **Phân tích dữ liệu**: Hiểu điểm yếu của từng người
- **Tối ưu nội dung**: Điều chỉnh độ khó câu hỏi

## Hướng dẫn sử dụng

### Bước 1: Tạo lộ trình
1. Vào chế độ "Ôn luyện" từ màn hình chính
2. Chọn bộ câu hỏi muốn học
3. Nhấn "🎯 Tạo lộ trình ôn tập"
4. Nhập thông tin và xác nhận

### Bước 2: Học hàng ngày
1. Vào lộ trình đã tạo
2. Nhấn "📚 Bắt đầu học hôm nay"
3. Trả lời câu hỏi và đánh giá độ khó
4. Hoàn thành bài học trong ngày

### Bước 3: Tiến vào Giai đoạn 2
1. Tiếp tục học đến khi tất cả câu hỏi "Dễ"
2. Hệ thống tự động chuyển giai đoạn
3. Làm bài thi thử tổng hợp

## Troubleshooting

### Câu hỏi thường gặp

**Q: Tôi có thể thay đổi lịch trình không?**
A: Hiện tại chưa hỗ trợ. Bạn có thể xóa lộ trình cũ và tạo mới.

**Q: Dữ liệu có bị mất khi đóng trình duyệt?**
A: Không, dữ liệu được lưu trong LocalStorage của trình duyệt.

**Q: Làm sao để đánh giá lại câu hỏi?**
A: Khi câu hỏi xuất hiện lại, bạn có thể đánh giá lại độ khó.

## Roadmap tương lai

### Version 2.0
- [ ] Sync dữ liệu cloud
- [ ] Thống kê chi tiết hơn  
- [ ] Nhắc nhở học tập
- [ ] Export báo cáo tiến độ

### Version 3.0
- [ ] AI tối ưu hóa lộ trình
- [ ] Gamification elements
- [ ] Social learning features
- [ ] Mobile app

---
*Tài liệu này được cập nhật lần cuối: ${new Date().toLocaleDateString('vi-VN')}*
