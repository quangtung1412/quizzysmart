# Admin Menu Restructure & Model Management

## Tóm tắt thay đổi

### 1. Cấu trúc lại menu Admin với Dropdown Groups

Menu admin đã được tổ chức lại thành các nhóm dropdown để dễ quản lý:

#### 👥 Quản lý người dùng
- Người dùng
- Subscriptions

#### 📚 Quản lý kiến thức
- Quản lý bài thi
- Kiến thức
- Văn bản RAG
- Collections

#### ⚙️ Cài đặt hệ thống
- Quản lý gói
- **Quản lý Models** (MỚI)
- AI Model Stats
- AI Search History
- Cài đặt chung

### 2. Màn hình Quản lý Models (MỚI)

Đã thêm màn hình mới để quản lý các AI models sử dụng trong ứng dụng:

#### Các loại model có thể cấu hình:

1. **🤖 Model mặc định**
   - Mặc định: `gemini-2.5-flash`
   - Dùng cho các câu hỏi thông thường
   - Cân bằng giữa tốc độ và chất lượng

2. **💰 Model tiết kiệm**
   - Mặc định: `gemini-2.0-flash-lite`
   - Model nhẹ và nhanh hơn
   - Tiết kiệm quota cho các truy vấn đơn giản

3. **🔤 Embedding Model**
   - Mặc định: `gemini-embedding-001`
   - Dùng cho việc tạo embeddings trong RAG
   - Hỗ trợ tìm kiếm ngữ nghĩa

#### Các model có sẵn:
- `gemini-2.5-flash` - Model mới nhất, cân bằng
- `gemini-2.0-flash` - Model ổn định, tốc độ cao
- `gemini-2.0-flash-lite` - Model nhẹ, tiết kiệm
- `gemini-2.5-flash-lite` - Phiên bản lite của 2.5
- `gemini-2.0-flash-exp` - Phiên bản experimental
- `gemini-2.5-pro` - Model mạnh nhất (sử dụng nhiều quota)

#### Embedding models:
- `gemini-embedding-001` - Model embedding tiêu chuẩn
- `text-embedding-004` - Alternative embedding model

### 3. Các file đã thay đổi

#### Frontend:
1. **components/admin/ModelManagement.tsx** (MỚI)
   - Component quản lý model settings
   - UI để chọn và lưu các models
   - Hiển thị thông tin về từng model

2. **components/AdminDashboard.tsx**
   - Thêm state cho dropdown menus
   - Tái cấu trúc navigation với dropdown groups
   - Thêm route cho model-settings tab

#### Backend:
3. **server/src/index.ts**
   - Thêm endpoint `GET /api/admin/model-settings`
   - Thêm endpoint `PUT /api/admin/model-settings`
   - Xử lý lưu và truy xuất cấu hình models

4. **server/prisma/schema.prisma**
   - Thêm model `ModelSettings` với các fields:
     - `defaultModel` - Model mặc định
     - `cheaperModel` - Model tiết kiệm
     - `embeddingModel` - Model embedding
     - `updatedAt` - Thời gian cập nhật
     - `updatedBy` - Email admin cập nhật

### 4. Database Migration

Migration đã được tạo và chạy thành công:
```
npx prisma migrate dev --name add_model_settings
```

Table mới `model_settings` đã được tạo trong database.

### 5. Cách sử dụng

1. Đăng nhập với tài khoản admin
2. Vào Admin Dashboard
3. Click vào dropdown "Cài đặt hệ thống"
4. Chọn "Quản lý Models"
5. Chọn các models mong muốn cho từng mục đích
6. Click "Lưu cài đặt"

### 6. Lợi ích

✅ Menu admin gọn gàng và dễ quản lý hơn với dropdown groups
✅ Tập trung các settings liên quan vào cùng một nhóm
✅ Dễ dàng cấu hình models cho các use case khác nhau
✅ Tối ưu hóa việc sử dụng quota bằng cách chọn model phù hợp
✅ Linh hoạt thay đổi models mà không cần sửa code

### 7. Tương lai có thể mở rộng

- Thêm metrics về usage của từng model
- Tự động chuyển đổi model dựa trên load
- Cấu hình fallback models khi model chính không khả dụng
- A/B testing với các models khác nhau
