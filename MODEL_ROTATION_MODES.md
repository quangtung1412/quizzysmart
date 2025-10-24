# 🔄 Model Rotation: 2 Chế Độ Hoạt Động

## 📋 Tổng Quan

Hệ thống Model Rotation có **2 chế độ** hoạt động tùy thuộc vào setting `modelRotationEnabled`:

### 🆓 Chế Độ 1: FREE TIER (Rotation ON)
- **Khi nào dùng**: API key Google chưa nâng cấp, dùng free tier
- **Đặc điểm**: Quản lý quota chặt chẽ để tránh vượt giới hạn

### 💰 Chế Độ 2: PAID TIER (Rotation OFF)
- **Khi nào dùng**: Đã nâng cấp API key lên Paid Plan (1000+ RPM)
- **Đặc điểm**: Không cần tracking quota, dùng 1 model cố định

---

## 🆓 FREE TIER MODE (modelRotationEnabled = true)

### Mục đích
Tối ưu hóa việc sử dụng **free quota** của Google Gemini API bằng cách xoay vòng giữa nhiều models.

### Cách hoạt động

```typescript
// Backend: server/src/index.ts
if (systemSettings.modelRotationEnabled) {
  // 1. Lấy model available từ rotation service
  selectedModel = geminiModelRotation.getNextAvailableModel();
  // Returns: { name: 'gemini-2.5-flash', rpm: 10, rpd: 250, priority: 1 }
  
  if (!selectedModel) {
    // Tất cả 10 models đã đạt limit → Return 503
    return res.status(503).json({
      error: 'Tất cả các model AI (free tier) đã đạt giới hạn...'
    });
  }
  
  // 2. Sử dụng model
  const model = genAI.getGenerativeModel({ model: selectedModel.name });
  const result = await model.generateContent([prompt, imagePart]);
  
  // 3. GHI NHẬN request để tracking quota
  geminiModelRotation.recordRequest(selectedModel.name);
  // → requestCount++, dailyRequestCount++
  // → Tự động skip model này nếu đạt RPM/RPD limit
}
```

### Luồng chi tiết

```
Request #1-10:
  → getNextAvailableModel()
  → Priority 1: gemini-2.5-flash (RPM: 10, RPD: 250)
  → Use model
  → recordRequest() → RPM: 1/10, 2/10, ..., 10/10
  
Request #11:
  → getNextAvailableModel()
  → Priority 1: gemini-2.5-flash FULL (RPM: 10/10)
  → Priority 2: gemini-2.0-flash OK (RPM: 0/15)
  → Switch to gemini-2.0-flash
  → recordRequest() → RPM: 1/15
  
After 60 seconds:
  → Auto reset all RPM counters → Back to Priority 1
  
After 24 hours:
  → Auto reset all RPD counters
```

### Models được quản lý (10 models)

| Priority | Model Name | RPM | RPD | Khi nào dùng |
|----------|-----------|-----|-----|--------------|
| 1 | gemini-2.5-flash | 10 | 250 | Đầu tiên (tốt nhất) |
| 2 | gemini-2.0-flash | 15 | 200 | Khi P1 hết |
| 3 | gemini-2.0-flash-lite | 30 | 200 | Khi P2 hết |
| 4 | gemini-2.5-flash-lite | 15 | 1000 | Khi P3 hết |
| ... | ... | ... | ... | ... |

### Logs

```bash
[AI Search] Model rotation ENABLED - Using free tier with quota management
[AI Search] Using model from rotation: gemini-2.5-flash (priority 1)
[ModelRotation] gemini-2.5-flash - RPM: 5/10, RPD: 120/250
[AI Search] Recorded request for quota tracking (free tier mode)

# Khi model đạt limit:
[ModelRotation] gemini-2.5-flash reached RPM limit (10/10)
[ModelRotation] Next available model: gemini-2.0-flash (priority 2)
```

### Ưu điểm ✅
- ✅ Tối đa hóa free quota (dùng 10 models)
- ✅ High availability (tự động failover)
- ✅ Không lo bị block API key
- ✅ Phù hợp cho production với nhiều users

### Nhược điểm ⚠️
- ⚠️ Có thể bị 503 nếu TẤT CẢ models đạt limit (hiếm)
- ⚠️ Cần monitor usage stats

---

## 💰 PAID TIER MODE (modelRotationEnabled = false)

### Mục đích
Sử dụng 1 model đã **nâng cấp lên Paid Plan** với giới hạn cao hơn nhiều (VD: 1000+ RPM).

### Cách hoạt động

```typescript
// Backend: server/src/index.ts
if (!systemSettings.modelRotationEnabled) {
  // 1. Lấy model mặc định (giả định đã paid)
  const defaultModelName = systemSettings.defaultModel; // e.g., 'gemini-2.5-flash'
  
  selectedModel = {
    name: defaultModelName,
    priority: 0,
    rpm: 999,      // Dummy value - KHÔNG tracking
    rpd: 999,      // Dummy value - KHÔNG tracking
    tpm: 999999,
    category: 'Paid/Upgraded'
  };
  
  // 2. Sử dụng model
  const model = genAI.getGenerativeModel({ model: selectedModel.name });
  const result = await model.generateContent([prompt, imagePart]);
  
  // 3. KHÔNG ghi nhận request (skip quota tracking)
  // → Giả định paid tier không có giới hạn cần lo
}
```

### Luồng chi tiết

```
Request #1:
  → Use defaultModel: gemini-2.5-flash
  → NO recordRequest() call
  → NO RPM/RPD tracking
  
Request #2, #3, ..., #1000:
  → Same model, no quota check
  → Hoàn toàn dựa vào giới hạn thực của Google Paid API
  
Nếu model chưa được nâng cấp (vẫn free):
  → Nhanh chóng đạt giới hạn thực (10 RPM)
  → Google API trả về error 429 (Too Many Requests)
  → User bị block ❌
```

### Logs

```bash
[AI Search] Model rotation DISABLED - Using paid/upgraded model: gemini-2.5-flash
[AI Search] Note: Assuming paid tier with high limits, RPM/RPD tracking disabled
[AI Search] Skipped quota tracking (paid/upgraded model mode)
```

### Ưu điểm ✅
- ✅ Đơn giản, dự đoán được (luôn 1 model)
- ✅ Không overhead từ rotation logic
- ✅ Phù hợp khi đã trả tiền cho Google API

### Nhược điểm ⚠️
- ⚠️ **NGUY HIỂM** nếu model chưa thực sự được nâng cấp
- ⚠️ Không có protection khỏi rate limits
- ⚠️ Admin phải tự quản lý và monitor

### ⚠️ CẢNH BÁO QUAN TRỌNG

**Khi TẮT rotation:**
1. ✅ Admin PHẢI đảm bảo model đã được nâng cấp lên Paid Tier
2. ✅ Kiểm tra Google Cloud Console → API quota settings
3. ✅ Verify RPM thực tế > 100 (free tier chỉ 10-30 RPM)
4. ❌ Nếu chưa nâng cấp mà tắt rotation → Hệ thống sẽ bị block nhanh chóng

---

## 🎛️ Admin Controls

### Trong System Settings

**Toggle: "Bật quay vòng model"**

```tsx
// ON (Free Tier Mode):
🔄 Free Tier Mode: Tự động chuyển đổi giữa 10 models để tối ưu quota

// OFF (Paid Tier Mode):
💰 Paid Tier Mode: Sử dụng 1 model đã nâng cấp (không giới hạn quota)
```

**Khi OFF → Hiển thị:**
```
🎯 Model mặc định (Paid/Upgraded Tier)
[Dropdown: gemini-2.5-flash]

💡 Model này sẽ được sử dụng cho tất cả các tìm kiếm AI
⚡ Lưu ý: Khi tắt quay vòng, hệ thống giả định bạn đã nâng cấp 
   model này lên Paid Tier với giới hạn cao hơn (VD: 1000+ RPM)
📊 Hệ thống sẽ KHÔNG tracking RPM/RPD quota cho model này
```

**Khi ON → Hiển thị:**
```
✅ Quay vòng model đang được bật (Free Tier Mode)
🔄 Hệ thống sẽ tự động chọn model tối ưu từ 10 models 
   dựa trên quota còn lại (RPM/RPD)
📊 Tất cả requests sẽ được tracking để tránh vượt quá 
   giới hạn của Google Free Tier
```

---

## 📊 So Sánh 2 Chế Độ

| Tiêu chí | Free Tier (ON) | Paid Tier (OFF) |
|----------|----------------|-----------------|
| **Số models** | 10 models xoay vòng | 1 model cố định |
| **Quota tracking** | ✅ Có (RPM/RPD) | ❌ Không |
| **Tự động failover** | ✅ Có | ❌ Không |
| **Giới hạn thực tế** | ~10-30 RPM/model | 1000+ RPM (nếu paid) |
| **Chi phí** | $0 | $$$ (Paid Plan) |
| **Khi đạt limit** | Tự động switch model | Error 429 từ Google |
| **Admin monitor** | Xem Model Stats | Tự check Google Console |
| **Độ phức tạp** | Cao | Thấp |
| **Phù hợp** | Dev, Testing, Startup | Production với budget |

---

## 🧪 Test Cases

### Test 1: Free Mode - Normal Flow
```bash
# Setup: modelRotationEnabled = true
curl -X POST /api/premium/search-by-image
# Expected: Use P1 model, record quota, success
```

### Test 2: Free Mode - All Models Exhausted
```bash
# Setup: All 10 models at RPM limit
curl -X POST /api/premium/search-by-image
# Expected: Return 503 error with usage stats
```

### Test 3: Paid Mode - Normal Flow
```bash
# Setup: modelRotationEnabled = false, defaultModel = 'gemini-2.5-flash'
curl -X POST /api/premium/search-by-image
# Expected: Use default model, NO quota tracking, success
```

### Test 4: Paid Mode - Model Not Actually Upgraded (⚠️ Danger)
```bash
# Setup: Rotation OFF, but API key still on free tier
# Send 100 requests rapidly
curl -X POST /api/premium/search-by-image (x100)
# Expected: First 10 OK, then Google returns 429 error
# System has NO protection → Users blocked ❌
```

---

## 🚀 Khuyến Nghị

### Cho Development/Testing:
✅ **Bật rotation** (Free Tier Mode)
- Không cần trả tiền
- Tự động quản lý quota
- Test được failover logic

### Cho Production nhỏ (<100 users):
✅ **Bật rotation** (Free Tier Mode)
- Free quota đủ dùng
- High availability
- Tiết kiệm chi phí

### Cho Production lớn (>100 users đồng thời):
✅ **Tắt rotation** + **Nâng cấp API key** (Paid Tier Mode)
- Quota cao (1000+ RPM)
- Không lo bị giới hạn
- Hiệu năng ổn định
- ⚠️ Nhớ thực sự nâng cấp API key trước!

---

## 📝 Checklist Khi Tắt Rotation

Trước khi tắt rotation, đảm bảo:

- [ ] Đã nâng cấp Google Cloud API key lên Paid Plan
- [ ] Verify quota trong Google Cloud Console
- [ ] RPM limit > 100 (free chỉ 10-30)
- [ ] Đã test với traffic thực tế
- [ ] Setup monitoring/alerting cho API errors
- [ ] Backup plan nếu bị rate limit

**Nếu chưa làm các bước trên → GIỮ ROTATION BẬT!**

---

## 🔗 Related Files

- `server/src/index.ts` (line ~2546): Model selection logic
- `server/src/gemini-model-rotation.ts`: Rotation service
- `components/admin/SystemSettings.tsx`: Admin UI
- `SYSTEM_SETTINGS_GUIDE.md`: Full documentation

---

**Tóm tắt:** Rotation ON = Free tier cẩn thận, Rotation OFF = Paid tier tự do (nhưng phải thực sự paid!)
