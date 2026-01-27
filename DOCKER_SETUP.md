# Docker Setup Guide - QuizZySmart với MySQL & Qdrant Localhost

## Tổng quan

Docker Compose sẽ khởi chạy các services sau:

| Service | Port | Mô tả |
|---------|------|-------|
| **MySQL** | 3306 | Database chính |
| **phpMyAdmin** | 8080 | Quản trị MySQL (Web UI) |
| **Qdrant** | 6333, 6334 | Vector database (REST & gRPC) |
| **Backend** | 3000 | API Server (Node.js) |
| **Frontend** | 5173 | React App |

## Cách truy cập

### phpMyAdmin (Quản trị MySQL)
- **URL**: http://localhost:8080
- **Server**: mysql (hoặc để trống)
- **Username**: root
- **Password**: rootpassword

### Qdrant Dashboard (Quản trị Vector DB)
- **URL**: http://localhost:6333/dashboard

### Frontend
- **URL**: http://localhost:5173

### Backend API
- **URL**: http://localhost:3000

---

## Hướng dẫn cài đặt

### Bước 1: Chuẩn bị file .env

```powershell
# Copy file cấu hình mẫu
Copy-Item -Path "server\.env.docker" -Destination "server\.env"
```

Mở `server/.env` và cập nhật các giá trị cần thiết:
- `GEMINI_API_KEY`: API key Google Gemini
- `JWT_SECRET`: Secret key cho JWT (thay đổi giá trị mặc định)

### Bước 2: Xóa dữ liệu cũ (nếu cần reset)

```powershell
# Dừng các container đang chạy
docker compose down

# Xóa volumes (DATABASE SẼ BỊ XÓA!)
docker volume rm quizzysmart_mysql-data quizzysmart_qdrant-data quizzysmart_uploaded-docs

# Hoặc xóa tất cả volumes không sử dụng
docker volume prune
```

### Bước 3: Build và khởi chạy

```powershell
# Build images và khởi chạy
docker compose up -d --build

# Xem logs để theo dõi tiến trình
docker compose logs -f
```

### Bước 4: Khởi tạo database (Prisma migration)

```powershell
# Chờ MySQL khởi động xong (khoảng 30s)
Start-Sleep -Seconds 30

# Tạo migration mới cho MySQL (lần đầu tiên)
docker compose exec backend npx prisma migrate dev --name init

# Hoặc chỉ deploy migration đã có
docker compose exec backend npx prisma migrate deploy
```

### Bước 5: Tạo tài khoản admin

```powershell
docker compose exec backend npx tsx scripts/create-admin.ts
```

---

## Thông tin kết nối MySQL

### Từ bên trong Docker network
```
Host: mysql
Port: 3306
Database: quizzysmart
Username: quizzysmart
Password: quizzysmart123
```

### Từ máy host
```
Host: localhost
Port: 3306
Database: quizzysmart
Username: root
Password: rootpassword
```

### DATABASE_URL format
```
mysql://quizzysmart:quizzysmart123@mysql:3306/quizzysmart
```

---

## Thông tin kết nối Qdrant

### Từ bên trong Docker network
```
URL: http://qdrant:6333
API Key: (để trống - không cần authentication)
```

### Từ máy host
```
URL: http://localhost:6333
Dashboard: http://localhost:6333/dashboard
```

---

## Các lệnh Docker thường dùng

### Quản lý containers

```powershell
# Khởi động
docker compose up -d

# Dừng
docker compose down

# Restart một service
docker compose restart backend

# Xem logs
docker compose logs -f backend
docker compose logs -f mysql

# Trạng thái containers
docker compose ps
```

### Quản lý database

```powershell
# Vào MySQL CLI
docker compose exec mysql mysql -u root -prootpassword quizzysmart

# Backup database
docker compose exec mysql mysqldump -u root -prootpassword quizzysmart > backup.sql

# Restore database
Get-Content backup.sql | docker compose exec -T mysql mysql -u root -prootpassword quizzysmart

# Chạy Prisma Studio (GUI)
docker compose exec backend npx prisma studio
```

### Debug

```powershell
# Shell vào container backend
docker compose exec backend sh

# Kiểm tra kết nối database
docker compose exec backend npx prisma db pull

# Test Qdrant connection
docker compose exec backend node -e "console.log('Test')"
```

---

## Troubleshooting

### MySQL không khởi động được
```powershell
# Xem logs MySQL
docker compose logs mysql

# Xóa volume và thử lại
docker compose down
docker volume rm quizzysmart_mysql-data
docker compose up -d mysql
```

### Backend không kết nối được MySQL
```powershell
# Kiểm tra MySQL đã ready chưa
docker compose exec mysql mysqladmin -u root -prootpassword ping

# Kiểm tra DNS resolution
docker compose exec backend ping mysql
```

### Prisma migration lỗi
```powershell
# Reset database và tạo lại migration
docker compose exec backend npx prisma migrate reset --force
```

### Qdrant không hoạt động
```powershell
# Xem logs Qdrant
docker compose logs qdrant

# Kiểm tra health
curl http://localhost:6333/readiness
```

---

## Development (không dùng Docker)

Nếu muốn chạy backend không qua Docker:

1. Cài đặt MySQL server trên máy local hoặc dùng container MySQL riêng:
```powershell
docker run -d --name mysql-dev -p 3306:3306 -e MYSQL_ROOT_PASSWORD=rootpassword -e MYSQL_DATABASE=quizzysmart mysql:8.0
```

2. Cài đặt Qdrant local:
```powershell
docker run -d --name qdrant-dev -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

3. Cập nhật `server/.env`:
```env
DATABASE_URL=mysql://root:rootpassword@localhost:3306/quizzysmart
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

4. Chạy backend:
```powershell
cd server
npm install
npx prisma migrate dev
npm run dev
```
