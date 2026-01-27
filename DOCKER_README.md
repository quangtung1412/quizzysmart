# QuizZySmart - Docker Setup với MySQL & Qdrant Local

## 📋 Tổng quan

Docker setup này bao gồm:
- **MySQL 8.0**: Database chính với UTF8MB4
- **phpMyAdmin**: Web interface quản lý MySQL
- **Qdrant**: Local vector database
- **Backend**: Node.js API server với auto-restore
- **Frontend**: React Vite dev server

## 🚀 Quick Start

### 1. Khởi động lần đầu

```powershell
# Build và start tất cả services
docker compose up -d --build

# Kiểm tra status
docker compose ps
```

Backend sẽ **tự động restore** backup mới nhất từ thư mục `backups/` khi database trống.

### 2. Truy cập ứng dụng

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **phpMyAdmin**: http://localhost:8080 (root/rootpassword)
- **Qdrant Dashboard**: http://localhost:6333/dashboard

## 💾 Quản lý Database

### Backup Database

```powershell
# Windows
.\docker-backup-mysql.ps1

# Backup với tên tùy chỉnh
.\docker-backup-mysql.ps1 -BackupName "production"

# Backup và nén
.\docker-backup-mysql.ps1 -BackupName "production" -Compress
```

```bash
# Linux
./docker-backup-mysql.sh

# Với options
./docker-backup-mysql.sh -n production -c
```

**Backup sẽ được lưu trong thư mục `backups/`**

### Restore Database

**Auto-restore khi start:**
- Backend tự động tìm và restore file backup **mới nhất** trong `backups/`
- Chỉ restore nếu database trống
- Nếu không có backup: tạo empty schema

**Manual restore:**

```powershell
# Windows
.\docker-restore-mysql.ps1 -BackupFile "backups\full_data_utf8_20260127_163637.sql"

# Không cần confirm
.\docker-restore-mysql.ps1 -BackupFile "backups\backup.sql" -Force
```

```bash
# Linux
./docker-restore-mysql.sh -f backups/full_data_utf8_20260127_163637.sql

# Không confirm
./docker-restore-mysql.sh -f backups/backup.sql --force
```

### Reset Database

```powershell
# Xóa database và tạo lại (backend sẽ auto-restore từ backup)
docker compose exec mysql mysql -u root -prootpassword --skip-ssl -e "DROP DATABASE IF EXISTS quizzysmart; CREATE DATABASE quizzysmart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restart backend để trigger auto-restore
docker compose restart backend
```

## 🔄 Workflow Thông Dụng

### Scenario 1: Development hàng ngày

```powershell
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Scenario 2: Backup định kỳ

```powershell
# Backup mỗi ngày/tuần
.\docker-backup-mysql.ps1 -BackupName "daily_$(Get-Date -Format 'yyyyMMdd')"
```

### Scenario 3: Deploy/Update code

```powershell
# Rebuild và restart
docker compose up -d --build

# Chỉ rebuild backend
docker compose build backend
docker compose up -d backend
```

### Scenario 4: Fresh start với data

```powershell
# 1. Stop containers
docker compose down

# 2. Đảm bảo có backup mới nhất trong thư mục backups/
ls backups/*.sql | sort LastWriteTime | select -last 1

# 3. Start lại (sẽ auto-restore từ backup mới nhất)
docker compose up -d --build
```

## 📁 Cấu trúc thư mục

```
quizzysmart/
├── backups/                          # SQL backup files (auto-restore từ đây)
│   ├── full_data_utf8_20260127.sql  # Backup đầy đủ
│   └── daily_20260128.sql           # Backup hàng ngày
├── server/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh         # Auto-restore logic
│   └── prisma/
│       └── schema.prisma
├── docker-compose.yml
├── docker-backup-mysql.ps1/.sh      # Backup scripts
└── docker-restore-mysql.ps1/.sh     # Manual restore scripts
```

## ⚙️ Environment Variables

File `server/.env.docker` (được load tự động):

```env
DATABASE_URL=mysql://root:rootpassword@mysql:3306/quizzysmart?charset=utf8mb4
QDRANT_URL=http://qdrant:6333
PORT=3000
NODE_ENV=production
```

## 🐛 Troubleshooting

### Backend không start

```powershell
# Check logs
docker compose logs backend --tail=100

# Restart
docker compose restart backend
```

### Database connection error

```powershell
# Check MySQL status
docker compose ps mysql

# Test connection
docker compose exec mysql mysql -u root -prootpassword --skip-ssl -e "SELECT 1;"
```

### Auto-restore không hoạt động

```powershell
# 1. Kiểm tra backup files
ls backups/*.sql

# 2. Check entrypoint logs
docker compose logs backend | Select-String "backup|restore"

# 3. Manual restore
.\docker-restore-mysql.ps1 -BackupFile "backups\your-backup.sql" -Force
```

### Lỗi charset/font chữ

Đảm bảo:
- DATABASE_URL có `?charset=utf8mb4`
- Backup tạo với `--default-character-set=utf8mb4`
- MySQL command dùng `--skip-ssl` để tránh lỗi encoding

## 🔒 Security Notes

**Cho production:**
1. Đổi MySQL passwords trong `docker-compose.yml`
2. Update `JWT_SECRET` và `SESSION_SECRET` trong `.env`
3. Không commit file `.env` vào git
4. Sử dụng Docker secrets cho sensitive data
5. Enable SSL cho MySQL connection

## 📊 Performance Tips

1. **Volumes**: Dữ liệu được persist trong Docker volumes:
   - `mysql-data`: MySQL database
   - `qdrant-data`: Qdrant vector database
   - `uploaded-docs`: File uploads

2. **Memory**: Mỗi service có thể cấu hình memory limits trong `docker-compose.yml`

3. **Backup size**: Sử dụng `-Compress` để giảm kích thước backup

## 🆘 Support Commands

```powershell
# View all containers
docker compose ps

# Check container health
docker compose ps backend

# View container logs
docker compose logs -f [service-name]

# Enter container shell
docker compose exec backend sh
docker compose exec mysql bash

# Check MySQL tables
docker compose exec mysql mysql -u root -prootpassword --skip-ssl quizzysmart -e "SHOW TABLES;"

# Count records
docker compose exec mysql mysql -u root -prootpassword --skip-ssl quizzysmart -e "SELECT 'Users' as tbl, COUNT(*) as cnt FROM User UNION SELECT 'Questions', COUNT(*) FROM Question;"

# Restart single service
docker compose restart [service-name]

# Rebuild single service
docker compose build [service-name]
docker compose up -d [service-name]

# Clean up everything
docker compose down -v  # Warning: Deletes volumes!
```

## 🎯 Auto-Restore Logic

Backend container (`docker-entrypoint.sh`):

1. **Wait for MySQL**: Kiểm tra MySQL ready
2. **Check database**: Count tables trong database
3. **If empty**:
   - Tìm file `.sql` mới nhất trong `/backups`
   - Restore backup đó
   - Nếu thành công: Start application
   - Nếu thất bại: Tạo empty schema
4. **If not empty**: Sync schema và start

**File backup được ưu tiên theo thời gian modification (mới nhất)**

---

Built with ❤️ for QuizZySmart
