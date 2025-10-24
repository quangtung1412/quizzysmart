# Tính Năng Premium - AI Trợ Lý

## 🌟 Tổng Quan

Tính năng Premium cho phép người dùng chụp ảnh hoặc upload ảnh câu hỏi, sau đó sử dụng Google Gemini AI để nhận dạng văn bản và tìm đáp án chính xác trong cơ sở dữ liệu.

**✨ MỚI: Live Camera Search** - Tính năng tìm kiếm trực tiếp giống Google Translate, chỉ cần hướng camera vào câu hỏi và xem đáp án ngay lập tức!

## ✨ Tính Năng Chính

### 📸 Mode 1: Upload Ảnh (ImageSearchScreen)
- 📸 **Chụp ảnh trực tiếp**: Sử dụng camera điện thoại để chụp câu hỏi
- 📁 **Upload ảnh**: Tải ảnh từ thư viện
- 🤖 **AI Gemini**: Nhận dạng văn bản tự động với độ chính xác cao
- 🔍 **Tìm kiếm thông minh**: So sánh với cơ sở dữ liệu và tìm câu hỏi phù hợp nhất
- ✅ **Hiển thị đáp án**: Xem ngay đáp án đúng và tỷ lệ khớp

### 🎥 Mode 2: Live Camera Search (MỚI!)
- 📹 **Camera trực tiếp**: Mở camera và hướng vào câu hỏi
- ⚡ **Realtime**: Kết quả hiển thị overlay ngay trên màn hình camera
- 🔄 **2 chế độ quét**:
  - **Thủ công**: Nhấn nút để chụp và tìm kiếm
  - **Tự động**: Quét liên tục mỗi 3 giây
- 🎯 **Overlay kết quả**: Hiển thị đáp án ngay trên camera view
- 🚀 **Trải nghiệm như Google Translate**: Không cần save ảnh, chỉ việc hướng camera

## 🛠️ Cài Đặt

### 1. Cài đặt dependencies

```bash
cd server
npm install
```

Package `@google/generative-ai` đã được thêm vào `package.json`.

### 2. Cấu hình Gemini API Key

1. Truy cập [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Tạo API Key mới
3. Thêm vào file `server/.env`:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 3. Khởi động server

```bash
cd server
npm run dev
```

## 📱 Cách Sử Dụng

### Mode 1: Upload Ảnh

#### Bước 1: Truy cập tính năng
Từ màn hình chính, chọn **"AI Trợ Lý"** (nút màu vàng với icon camera), sau đó chọn **"📸 Upload Ảnh"**.

#### Bước 2: Chọn ảnh
- **Chụp ảnh**: Nhấn "Chụp ảnh" để mở camera
- **Upload**: Nhấn "Tải ảnh từ thư viện" để chọn ảnh có sẵn

#### Bước 3: Chọn nguồn tìm kiếm
Chọn một hoặc nhiều cơ sở kiến thức để tìm kiếm đáp án.

#### Bước 4: Tìm kiếm
Nhấn **"Tìm kiếm đáp án"** và đợi AI xử lý (khoảng 2-5 giây).

#### Bước 5: Xem kết quả
- Văn bản được nhận dạng
- Câu hỏi khớp nhất
- Đáp án chính xác
- Tỷ lệ độ tin cậy

### Mode 2: Live Camera (Realtime) 🆕

#### Bước 1: Truy cập
Từ màn hình chính → **"AI Trợ Lý"** → **"🎥 Camera Trực Tiếp"**

#### Bước 2: Cài đặt
- Chọn cơ sở kiến thức để tìm kiếm
- Chọn chế độ:
  - **Thủ công**: Bạn nhấn nút để quét
  - **Tự động**: Quét liên tục mỗi 3 giây
- Nhấn **"Bắt đầu"**

#### Bước 3: Cho phép camera
Trình duyệt sẽ yêu cầu quyền truy cập camera, nhấn **"Allow"**.

#### Bước 4: Quét câu hỏi
- Hướng camera vào câu hỏi
- **Chế độ thủ công**: Nhấn nút tròn lớn màu vàng
- **Chế độ tự động**: Giữ camera cố định, AI sẽ tự động quét

#### Bước 5: Xem kết quả ngay trên màn hình
Kết quả hiển thị dạng overlay ở dưới màn hình với:
- ✅ Câu hỏi được tìm thấy
- ✅ Các phương án (đáp án đúng highlight màu xanh)
- ✅ Độ tin cậy

**💡 Tips**: Di chuyển camera đến câu hỏi khác để tiếp tục tìm kiếm!

## 🔧 API Endpoint

### POST `/api/premium/search-by-image`

**Request:**
```json
{
  "image": "base64_encoded_image_string",
  "knowledgeBaseIds": ["kb_id_1", "kb_id_2"]
}
```

**Response:**
```json
{
  "recognizedText": "Câu hỏi được nhận dạng...",
  "matchedQuestion": {
    "id": "question_id",
    "question": "Nội dung câu hỏi",
    "options": ["A", "B", "C", "D"],
    "correctAnswerIndex": 1,
    "source": "Nguồn",
    "category": "Danh mục",
    "knowledgeBaseName": "Tên cơ sở kiến thức"
  },
  "confidence": 85
}
```

## 🎯 Thuật Toán Tìm Kiếm

1. **Nhận dạng văn bản**: Gemini AI trích xuất văn bản từ ảnh
2. **Chuẩn hóa**: Loại bỏ ký tự đặc biệt, chuyển thành chữ thường
3. **So khớp**: Tính điểm tương đồng dựa trên số từ khớp
4. **Lọc kết quả**: Chỉ trả về kết quả có độ khớp > 30%
5. **Sắp xếp**: Chọn kết quả có điểm cao nhất

## 💡 Tips Để Có Kết Quả Tốt

- ✅ Chụp trong điều kiện đủ ánh sáng
- ✅ Đảm bảo toàn bộ câu hỏi nằm trong khung hình
- ✅ Tránh mờ, nhòe, nghiêng
- ✅ Chọn đúng cơ sở kiến thức
- ❌ Tránh che khuất một phần câu hỏi

## 🔐 Bảo Mật

- Yêu cầu đăng nhập
- API key được lưu an toàn trong server
- Không lưu trữ ảnh upload

## 🚀 Tính Năng Tương Lai

- [ ] Cải thiện thuật toán khớp văn bản (Levenshtein distance, fuzzy matching)
- [ ] Hỗ trợ nhiều ngôn ngữ
- [ ] Lưu lịch sử tìm kiếm
- [ ] Batch processing (nhiều ảnh cùng lúc)
- [ ] OCR tối ưu cho chữ viết tay

## 📝 Lưu Ý

- Gemini API có giới hạn request/phút (Free tier: 60 requests/minute)
- Kích thước ảnh tối đa: ~15MB (theo `MAX_BODY_SIZE`)
- Thời gian xử lý trung bình: 2-5 giây

## 🐛 Troubleshooting

### Lỗi "Failed to process image search"
- Kiểm tra `GEMINI_API_KEY` trong `.env`
- Kiểm tra kết nối internet
- Xem log server để biết chi tiết

### Không tìm thấy kết quả
- Chọn đúng cơ sở kiến thức
- Chụp ảnh rõ hơn
- Câu hỏi có thể chưa có trong database

### Độ chính xác thấp
- Cải thiện chất lượng ảnh
- Cập nhật thuật toán so khớp
- Thêm nhiều câu hỏi vào database

## 📞 Hỗ Trợ

Liên hệ: Phạm Quang Tùng - Agribank Chi nhánh Hải Dương
