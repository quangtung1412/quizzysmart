# React Router Migration Guide

## Tổng quan
Project đã được chuyển đổi thành công từ state-based navigation sang React Router. Giao diện giữ nguyên, chỉ thay đổi logic điều hướng.

## Cấu trúc Routes

### Public Routes (Không cần đăng nhập)
- `/login` - Màn hình đăng nhập
- `/register` - Màn hình đăng ký

### Protected Routes (Cần đăng nhập)
- `/` - Màn hình chọn chế độ (Mode Selection)
- `/user-setup` - Thiết lập thông tin người dùng

#### Knowledge Base & Practice
- `/knowledge-base` - Danh sách kiến thức
- `/upload` - Upload file Excel (Admin only)
- `/menu` - Menu chọn chế độ ôn tập
- `/setup` - Thiết lập bài quiz
- `/quiz` - Màn hình làm quiz
- `/results` - Kết quả quiz
- `/history` - Lịch sử làm quiz

#### Tests
- `/tests` - Danh sách bài kiểm tra
- `/tests/:testId` - Chi tiết bài kiểm tra
- `/tests/:testId/attempt/:attemptId` - Chi tiết lần làm bài

#### Study Plans
- `/study-plan/list` - Danh sách lộ trình ôn tập
- `/study-plan/setup` - Tạo lộ trình ôn tập mới
- `/study-plan/overview` - Tổng quan lộ trình
- `/study-plan/daily` - Ôn tập hằng ngày
- `/study-plan/review` - Ôn tập thông minh

#### Premium Features
- `/quick-search` - Tìm kiếm nhanh
- `/premium-intro` - Giới thiệu tính năng Premium
- `/live-camera` - Tìm kiếm qua camera
- `/premium-plans` - Gói Premium

#### Admin
- `/admin` - Bảng điều khiển Admin

## Thay đổi chính

### Trước (State-based)
```tsx
const [currentScreen, setCurrentScreen] = useState<Screen>('login');

// Navigation
setCurrentScreen('modeSelection');
```

### Sau (React Router)
```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// Navigation
navigate('/');
```

## Components mới

### ProtectedRoute
Bảo vệ routes cần authentication. Tự động redirect về `/login` nếu chưa đăng nhập.

```tsx
<Route path="/" element={
  <ProtectedRoute user={user}>
    <ModeSelectionScreen ... />
  </ProtectedRoute>
} />
```

### AppLayout
Layout chung cho tất cả các màn hình sau khi đăng nhập, bao gồm:
- Header với logo, thông tin user
- AI quota display
- Premium button
- Logout button
- Footer

## URL Parameters

### Dynamic Routes
- `:testId` - ID của bài kiểm tra
- `:attemptId` - ID của lần làm bài

Sử dụng `useParams` để lấy parameters:
```tsx
const { testId } = useParams<{ testId: string }>();
```

## Navigation Methods

### Programmatic Navigation
```tsx
const navigate = useNavigate();
navigate('/tests'); // Forward navigation
navigate(-1); // Go back
navigate('/', { replace: true }); // Replace current entry
```

### Conditional Navigation
```tsx
if (user && user.aiSearchQuota > 0) {
  navigate('/live-camera');
} else {
  navigate('/premium-intro');
}
```

## Lợi ích của React Router

1. **URL Sharing**: Người dùng có thể share và bookmark URLs cụ thể
2. **Browser History**: Nút Back/Forward của trình duyệt hoạt động tự nhiên
3. **Deep Linking**: Có thể truy cập trực tiếp vào bất kỳ màn hình nào
4. **SEO Friendly**: Tốt hơn cho việc index của search engines
5. **Code Organization**: Routes được tổ chức rõ ràng hơn

## Testing

Để test local:
```bash
npm run dev
```

Truy cập các URLs:
- http://localhost:5173/login
- http://localhost:5173/
- http://localhost:5173/tests
- etc.

## Deployment Notes

Khi deploy lên production, đảm bảo server được cấu hình để:
1. Serve `index.html` cho tất cả routes (cho client-side routing)
2. Ví dụ với Nginx:
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Migration Checklist

✅ Tạo AppWithRouter.tsx với tất cả routes
✅ Chuyển đổi tất cả setCurrentScreen thành navigate()
✅ Tạo ProtectedRoute component
✅ Tạo AppLayout component
✅ Cập nhật index.tsx để sử dụng AppWithRouter
✅ Test build thành công
✅ Không có TypeScript errors

## Ghi chú

- File `App.tsx` cũ vẫn được giữ lại để tham khảo
- Tất cả logic business và state management giữ nguyên
- Giao diện UI giữ nguyên 100%
- Chỉ thay đổi cách điều hướng giữa các màn hình
