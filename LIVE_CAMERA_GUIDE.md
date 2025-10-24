# 🎥 Live Camera Search - Hướng Dẫn Chi Tiết

## 📖 Tổng Quan

**Live Camera Search** là tính năng mới nhất của Quizzy Smart Premium, cho phép bạn tìm đáp án **trực tiếp** qua camera - tương tự như tính năng dịch trực tiếp của Google Translate!

### ✨ Điểm Nổi Bật

- 🎥 **Camera realtime**: Không cần chụp và save ảnh
- ⚡ **Kết quả tức thì**: Đáp án hiển thị ngay trên màn hình camera
- 🔄 **2 chế độ quét**:
  - **Thủ công**: Bạn kiểm soát khi nào quét
  - **Tự động**: AI quét liên tục mỗi 3 giây
- 📱 **Mobile-first**: Tối ưu cho điện thoại, dùng camera sau
- 🎯 **Overlay UI**: Kết quả hiển thị overlay đẹp mắt

## 🚀 Cách Sử Dụng

### Bước 1️⃣: Truy cập tính năng

1. Đăng nhập vào Quizzy Smart
2. Từ màn hình chọn chế độ, chọn **"AI Trợ Lý"** (nút màu vàng)
3. Chọn **"🎥 Camera Trực Tiếp"**

### Bước 2️⃣: Cài đặt

Màn hình cài đặt sẽ hiện ra với các tùy chọn:

#### A. Chọn nguồn tìm kiếm
- Tick chọn một hoặc nhiều cơ sở kiến thức
- Có thể dùng nút **"Chọn tất cả"** để nhanh hơn
- ⚠️ Chọn đúng nguồn chứa câu hỏi để có kết quả tốt

#### B. Chọn chế độ quét

**Chế độ Thủ công** (Manual):
- ✅ Phù hợp khi: Muốn kiểm soát chính xác khi nào tìm kiếm
- 💡 Cách dùng: Hướng camera → nhấn nút tròn lớn màu vàng
- ⏱️ Throttle: Tối thiểu 2 giây giữa các lần quét

**Chế độ Tự động** (Auto):
- ✅ Phù hợp khi: Ôn tập nhiều câu liên tục, không muốn nhấn nút
- 💡 Cách dùng: Hướng camera và giữ yên, AI tự quét
- ⏱️ Interval: Tự động quét mỗi 3 giây
- 🔄 Hiển thị: Indicator "Đang quét tự động..." ở dưới màn hình

#### C. Bắt đầu
- Nhấn nút **"Bắt đầu"**
- Trình duyệt sẽ yêu cầu quyền camera → chọn **"Allow"**
- Camera sẽ mở, sử dụng camera sau (facingMode: environment)

### Bước 3️⃣: Quét câu hỏi

#### Với chế độ Thủ công:
1. Hướng camera vào câu hỏi
2. Đảm bảo toàn bộ câu hỏi và các phương án nằm trong khung hình
3. Nhấn nút tròn lớn màu vàng ở dưới màn hình
4. Đợi 2-5 giây để AI xử lý
5. Kết quả hiển thị overlay ở dưới màn hình

#### Với chế độ Tự động:
1. Hướng camera vào câu hỏi
2. Giữ camera ổn định (không cần nhấn nút)
3. AI tự động quét mỗi 3 giây
4. Di chuyển đến câu hỏi khác để tiếp tục
5. Kết quả cập nhật realtime

### Bước 4️⃣: Xem kết quả

Khi tìm thấy đáp án, một **overlay màu xanh** sẽ hiển thị ở dưới màn hình với:

✅ **Header**: 
- Indicator "Tìm thấy đáp án!" với chấm xanh nhấp nháy
- Badge độ tin cậy (%), ví dụ: "85% khớp"

✅ **Nội dung**:
- Câu hỏi được tìm thấy
- Danh sách các phương án A, B, C, D
- **Đáp án đúng** highlight màu xanh đậm với dấu ✓

✅ **Tương tác**:
- Có thể scroll nếu nội dung dài
- Di chuyển camera đến câu khác để tìm tiếp

Nếu **không tìm thấy**, sẽ hiển thị overlay màu vàng với gợi ý:
- "Không tìm thấy"
- Hướng dẫn: Di chuyển camera, chụp rõ hơn, chọn đúng nguồn

## 🎛️ Các Controls

### Trong khi đang quét:

**Header Controls:**
- **Nút Back** (←): Thoát camera và quay lại
- **Nút Settings** (⚙️): Mở lại bảng cài đặt

**Bottom Controls:**
- **Chế độ Thủ công**: Nút tròn lớn màu vàng (nhấn để quét)
- **Chế độ Tự động**: Indicator "Đang quét tự động..."

**Processing Indicator:**
- Khi đang xử lý: Badge "Đang xử lý..." màu vàng ở top center

## ⚡ Performance & Optimization

### Throttling
- **Minimum gap**: 2 giây giữa các lần capture
- **Auto interval**: 3 giây mỗi lần quét tự động
- Ngăn spam requests và tiết kiệm API quota

### Camera Settings
- **Resolution**: 1920x1080 (ideal)
- **Facing mode**: environment (camera sau)
- **Auto-play**: enabled
- **Muted**: enabled (không có audio)

### Image Processing
- **Format**: JPEG
- **Quality**: 0.8 (80%)
- **Method**: Canvas capture từ video stream
- **Base64 encoding**: Tự động

## 🔧 Troubleshooting

### Camera không mở
- ✅ Kiểm tra quyền camera trong browser settings
- ✅ Đảm bảo không có app khác đang dùng camera
- ✅ Reload trang và thử lại
- ✅ Trên iOS: Cần HTTPS để truy cập camera

### Không tìm thấy kết quả
- ✅ Chọn đúng cơ sở kiến thức
- ✅ Hướng camera thẳng, không nghiêng
- ✅ Đảm bảo đủ ánh sáng, ảnh rõ nét
- ✅ Câu hỏi phải có trong database

### Kết quả bị lag
- ✅ Kết nối internet ổn định
- ✅ Dùng chế độ Thủ công thay vì Tự động
- ✅ Đợi xử lý xong trước khi quét tiếp

### Độ chính xác thấp
- ✅ Cải thiện ánh sáng
- ✅ Camera gần hơn (nhưng vẫn thấy hết câu hỏi)
- ✅ Giữ camera ổn định khi quét

## 🆚 So Sánh với Upload Mode

| Tính năng | Live Camera | Upload Ảnh |
|-----------|-------------|------------|
| Tốc độ | ⚡ Realtime | 🐢 Phải chọn ảnh |
| Tiện lợi | 🎯 Rất cao | 📸 Trung bình |
| Lưu ảnh | ❌ Không | ✅ Có thể |
| Quét liên tục | ✅ Có (auto) | ❌ Không |
| Dùng khi nào | Ôn tập nhanh | Review kỹ, lưu trữ |
| Điện thoại | 📱 Tối ưu | 💻 Cả PC & mobile |

## 💻 Technical Details

### Component: `LiveCameraSearch.tsx`

**Dependencies:**
- React hooks: `useState`, `useRef`, `useEffect`, `useCallback`
- MediaDevices API
- Canvas API
- Fetch API

**State Management:**
- Video stream ref
- Canvas ref for capturing
- Search results
- Processing state
- Settings visibility
- Capture mode (auto/manual)

**API Integration:**
- Endpoint: `POST /api/premium/search-by-image`
- Payload: base64 image + knowledge base IDs
- Response: recognized text + matched question

## 🎨 UI/UX Design

### Color Scheme:
- **Primary**: Amber/Yellow gradient (premium feel)
- **Success**: Green (when found)
- **Warning**: Yellow (not found)
- **Processing**: Amber with pulse animation

### Layout:
- **Full screen**: Immersive camera view
- **Overlay controls**: Non-intrusive
- **Bottom result panel**: Easy to read
- **Gradient backdrops**: Better readability

### Animations:
- Pulse indicator khi đang quét
- Smooth transitions
- Scale on button press
- Fade in/out overlays

## 📊 Analytics & Monitoring

Các metrics để theo dõi:
- ✅ Số lần quét thành công
- ✅ Số lần không tìm thấy
- ✅ Thời gian xử lý trung bình
- ✅ Tỷ lệ confidence trung bình
- ✅ Chế độ được dùng nhiều nhất (auto vs manual)

## 🔐 Security & Privacy

- ✅ Không lưu trữ video stream
- ✅ Không lưu ảnh capture
- ✅ Chỉ gửi base64 image khi search
- ✅ Yêu cầu authentication
- ✅ Camera stop khi thoát screen

## 🚀 Future Enhancements

- [ ] OCR cải tiến với preprocessing
- [ ] Zoom in/out camera
- [ ] Flashlight control
- [ ] History của các lần quét
- [ ] Bookmark câu hỏi
- [ ] Share kết quả
- [ ] Offline mode với cached questions
- [ ] Multi-language support

---

**🎉 Enjoy Live Camera Search!**

Nếu có vấn đề, liên hệ: Phạm Quang Tùng - Agribank Chi nhánh Hải Dương
