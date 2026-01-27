# ============================================
# QuizZySmart - Docker Setup Script
# ============================================
# Script để thiết lập môi trường Docker với MySQL & Qdrant
# Chạy: .\docker-setup.ps1

param(
    [switch]$Reset,      # Reset toàn bộ (xóa volumes)
    [switch]$Build,      # Build lại images
    [switch]$Logs,       # Hiển thị logs
    [switch]$Stop        # Dừng services
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "QuizZySmart Docker Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Kiểm tra Docker đang chạy
try {
    docker info | Out-Null
} catch {
    Write-Host "ERROR: Docker không chạy. Vui lòng khởi động Docker Desktop." -ForegroundColor Red
    exit 1
}

# Stop services
if ($Stop) {
    Write-Host "`n[1/1] Dừng tất cả containers..." -ForegroundColor Yellow
    docker compose down
    Write-Host "Đã dừng!" -ForegroundColor Green
    exit 0
}

# Show logs
if ($Logs) {
    docker compose logs -f
    exit 0
}

# Reset mode - xóa volumes
if ($Reset) {
    Write-Host "`n[WARNING] Chế độ RESET - Tất cả dữ liệu sẽ bị xóa!" -ForegroundColor Red
    $confirm = Read-Host "Bạn có chắc chắn? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Đã hủy." -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "`n[1/4] Dừng containers..." -ForegroundColor Yellow
    docker compose down
    
    Write-Host "`n[2/4] Xóa volumes..." -ForegroundColor Yellow
    docker volume rm quizzysmart_mysql-data quizzysmart_qdrant-data quizzysmart_uploaded-docs 2>$null
    
    Write-Host "`n[3/4] Xóa images cũ..." -ForegroundColor Yellow  
    docker compose rm -f
}

# Kiểm tra và copy file .env
if (-not (Test-Path "server\.env")) {
    if (Test-Path "server\.env.docker") {
        Write-Host "`n[INFO] Tạo file server/.env từ .env.docker..." -ForegroundColor Yellow
        Copy-Item "server\.env.docker" "server\.env"
        Write-Host "QUAN TRỌNG: Cập nhật GEMINI_API_KEY và JWT_SECRET trong server/.env" -ForegroundColor Magenta
    } else {
        Write-Host "ERROR: Không tìm thấy server/.env.docker" -ForegroundColor Red
        exit 1
    }
}

# Build và start
$buildArg = ""
if ($Build -or $Reset) {
    $buildArg = "--build"
}

Write-Host "`n[1/4] Khởi động MySQL & Qdrant..." -ForegroundColor Yellow
docker compose up -d mysql qdrant $buildArg

Write-Host "`n[2/4] Chờ MySQL khởi động (30s)..." -ForegroundColor Yellow
for ($i = 30; $i -gt 0; $i--) {
    Write-Host -NoNewline "`r    Còn $i giây...   "
    Start-Sleep -Seconds 1
}
Write-Host "`r    Hoàn tất!                    "

# Kiểm tra MySQL đã sẵn sàng
Write-Host "`n[3/4] Kiểm tra MySQL..." -ForegroundColor Yellow
$maxRetries = 10
$retry = 0
while ($retry -lt $maxRetries) {
    $result = docker compose exec mysql mysqladmin -u root -prootpassword ping 2>&1
    if ($result -match "alive") {
        Write-Host "    MySQL đã sẵn sàng!" -ForegroundColor Green
        break
    }
    $retry++
    Write-Host "    Đang chờ MySQL... ($retry/$maxRetries)"
    Start-Sleep -Seconds 5
}

if ($retry -eq $maxRetries) {
    Write-Host "ERROR: MySQL không khởi động được!" -ForegroundColor Red
    docker compose logs mysql
    exit 1
}

# Khởi động backend và frontend
Write-Host "`n[4/4] Khởi động Backend & Frontend..." -ForegroundColor Yellow
docker compose up -d backend frontend $buildArg

# Chờ backend khởi động
Write-Host "`nChờ Backend khởi động..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Hiển thị trạng thái
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "TRẠNG THÁI CONTAINERS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
docker compose ps

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "THÔNG TIN TRUY CẬP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Frontend:     http://localhost:5173" -ForegroundColor Green
Write-Host "Backend API:  http://localhost:3000" -ForegroundColor Green
Write-Host "phpMyAdmin:   http://localhost:8080" -ForegroundColor Green
Write-Host "              - User: root, Pass: rootpassword" -ForegroundColor Gray
Write-Host "Qdrant UI:    http://localhost:6333/dashboard" -ForegroundColor Green

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "HƯỚNG DẪN TIẾP THEO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

if ($Reset) {
    Write-Host "Vì bạn chọn RESET, cần chạy migration:" -ForegroundColor Yellow
    Write-Host "  docker compose exec backend npx prisma migrate dev --name init" -ForegroundColor White
    Write-Host "`nSau đó tạo tài khoản admin:" -ForegroundColor Yellow
    Write-Host "  docker compose exec backend npx tsx scripts/create-admin.ts" -ForegroundColor White
}

Write-Host "`nXem logs:" -ForegroundColor Yellow
Write-Host "  docker compose logs -f" -ForegroundColor White
Write-Host "  .\docker-setup.ps1 -Logs" -ForegroundColor White

Write-Host "`nDừng services:" -ForegroundColor Yellow
Write-Host "  docker compose down" -ForegroundColor White
Write-Host "  .\docker-setup.ps1 -Stop" -ForegroundColor White

Write-Host ""
