# 🚀 Quick Start: Gemini Model Rotation

## TL;DR
Hệ thống tự động xoay vòng 10 models Gemini để tận dụng tối đa free quota, tăng throughput từ 10 RPM lên 167 RPM.

## ⚡ Start Server

```bash
cd server
npm install
npm run dev
```

## 🎯 Test Ngay

### 1. Test Live Camera Search (User)
1. Mở app: http://localhost:5173
2. Đăng nhập
3. Chọn **Live Camera Search**
4. Chụp ảnh câu hỏi
5. ✅ Xem kết quả với info "AI Model: gemini-2.5-flash (P1)"

### 2. Check Model Stats (Admin)
1. Đăng nhập với tài khoản admin
2. Vào **Admin Panel**
3. Click tab **🤖 Gemini Model Stats**
4. ✅ Xem real-time usage của 10 models

### 3. Test Model Rotation (CLI)
```bash
cd server
npx ts-node test-model-rotation.ts
```
✅ Output sẽ hiển thị quá trình rotation giữa các models

## 📊 Xem Logs

```bash
# Server logs sẽ hiển thị:
[ModelRotation] Using model: gemini-2.5-flash (priority 1)
[ModelRotation] gemini-2.5-flash - RPM: 5/10, RPD: 25/250
[ModelRotation] gemini-2.5-flash limit reached, switching...
[ModelRotation] Next available: gemini-2.0-flash (priority 2)
```

## 🔧 Cấu hình

### Required: Set API Key
```bash
# server/.env
GEMINI_API_KEY=your_actual_api_key_here
```

### Optional: Adjust Models
Edit `server/src/gemini-model-rotation.ts`:
```typescript
const MODEL_CONFIGS: ModelConfig[] = [
  { name: 'gemini-2.5-flash', rpm: 10, rpd: 250, priority: 1, ... },
  // Add/edit models here
];
```

## ✅ Verify Working

1. **Model Selection**: Check logs → Should show different models
2. **Rotation**: Send 20 requests → Should switch from P1 to P2
3. **Stats**: Admin dashboard → Should show usage increase
4. **Reset**: Click Reset All → Counters should go to 0

## 🐛 Troubleshooting

### Problem: Always uses same model
- ✅ Check: Model hasn't reached limit yet
- ✅ Solution: Send more requests or lower RPM limit

### Problem: 503 Error "All models exhausted"
- ✅ Check: Admin dashboard → All models red
- ✅ Solution: Wait 1 minute OR click Reset All

### Problem: Model info not showing in results
- ✅ Check: Server response includes `modelUsed` field
- ✅ Solution: Restart server, clear cache

## 📚 Full Documentation

- **Detailed Guide**: `GEMINI_MODEL_ROTATION.md`
- **Implementation Summary**: `MODEL_ROTATION_SUMMARY.md`
- **Checklist**: `IMPLEMENTATION_CHECKLIST.md`

## 🎉 That's it!

Hệ thống đã sẵn sàng và tự động xoay vòng models để maximize throughput! 🚀
