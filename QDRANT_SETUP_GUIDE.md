# Qdrant Cloud Setup Guide

## Bước 1: Tạo Qdrant Cloud Account

1. Truy cập: https://cloud.qdrant.io
2. Sign up với email hoặc GitHub
3. Xác nhận email

## Bước 2: Tạo Cluster

1. Click "Create Cluster"
2. Chọn plan:
   - **Free Tier**: 1GB storage, đủ cho testing
   - **Paid Plans**: Nếu cần scale lớn hơn

3. Chọn region gần nhất:
   - **Recommended**: Singapore (ap-southeast-1) cho VN
   
4. Đặt tên cluster: `vietnamese-documents` hoặc tùy ý

5. Click "Create"

## Bước 3: Lấy Connection Info

Sau khi cluster được tạo (~ 2-3 phút):

1. Click vào cluster name
2. Trong tab "Overview", bạn sẽ thấy:

```
Cluster URL: https://xxxxx-xxxxx.aws.cloud.qdrant.io:6333
API Key: ************************************
```

## Bước 4: Cập nhật .env

Copy thông tin vào `server/.env`:

```env
# Qdrant Configuration
QDRANT_URL=https://xxxxx-xxxxx.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=your-api-key-here
QDRANT_COLLECTION_NAME=vietnamese_documents
```

## Bước 5: Test Connection

Sau khi start server, kiểm tra log:

```
[Qdrant] Initializing connection to: https://xxxxx.qdrant.io:6333
[Qdrant] Connection established successfully
[Qdrant] Collection "vietnamese_documents" created successfully
```

## Alternative: Self-Hosted Qdrant (Localhost)

Nếu muốn test local trước:

### Sử dụng Docker:

```powershell
docker run -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant
```

### Cập nhật .env:

```env
QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY không cần (local mode)
QDRANT_COLLECTION_NAME=vietnamese_documents
```

### Ưu điểm localhost:
- ✅ Miễn phí hoàn toàn
- ✅ Không giới hạn storage
- ✅ Tốc độ nhanh hơn (local)

### Nhược điểm:
- ❌ Phải chạy Docker
- ❌ Không thể share giữa các máy
- ❌ Cần backup manual

## Recommended Approach

**Development/Testing**: 
- Sử dụng localhost với Docker

**Production**: 
- Sử dụng Qdrant Cloud (Singapore region)
- Backup tự động
- High availability
- Dễ scale

---

## Troubleshooting

### Lỗi: "Connection refused"
- Kiểm tra QDRANT_URL có đúng không
- Kiểm tra firewall/network

### Lỗi: "Unauthorized"
- Kiểm tra QDRANT_API_KEY
- Đảm bảo không có space thừa

### Lỗi: "Collection already exists"
- Không sao, hệ thống sẽ sử dụng collection hiện có
- Nếu muốn reset: xóa collection trên Qdrant UI

---

Bạn muốn sử dụng Qdrant Cloud hay localhost?
