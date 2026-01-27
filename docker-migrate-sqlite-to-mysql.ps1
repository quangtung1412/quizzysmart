# ============================================
# Migrate SQLite to MySQL (Docker Version)
# ============================================

param(
    [string]$SqliteFile = "server\prisma\dev.db"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Docker: SQLite to MySQL Migration" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if SQLite file exists
if (-not (Test-Path $SqliteFile)) {
    Write-Host "ERROR: SQLite file not found: $SqliteFile" -ForegroundColor Red
    exit 1
}

# Check containers
Write-Host "[1/5] Checking Docker containers..." -ForegroundColor Yellow
$mysqlStatus = docker compose ps mysql --format json | ConvertFrom-Json
$backendStatus = docker compose ps backend --format json | ConvertFrom-Json

if ($mysqlStatus.State -ne "running") {
    Write-Host "ERROR: MySQL container is not running!" -ForegroundColor Red
    exit 1
}
if ($backendStatus.State -ne "running") {
    Write-Host "ERROR: Backend container is not running!" -ForegroundColor Red
    exit 1
}
Write-Host "    All containers running!" -ForegroundColor Green

# Backup current MySQL data first
Write-Host ""
Write-Host "[2/5] Creating backup of current MySQL data..." -ForegroundColor Yellow
.\docker-backup-mysql.ps1 -BackupName "before_migration"
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Backup failed, but continuing..." -ForegroundColor Yellow
}

# Clear MySQL database
Write-Host ""
Write-Host "[3/5] Preparing MySQL database..." -ForegroundColor Yellow
docker compose exec mysql mysql -u root -prootpassword -e "SET NAMES utf8mb4; DROP DATABASE IF EXISTS quizzysmart; CREATE DATABASE quizzysmart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | Out-Null

# Run migrations
Write-Host "    Creating tables..." -ForegroundColor Gray
docker compose exec backend npx prisma migrate deploy 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    # Try migrate dev if deploy fails
    docker compose exec backend npx prisma migrate dev --name migration_from_sqlite --skip-seed 2>&1 | Select-String -Pattern "Applied|created|Your database" | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
}

# Run migration
Write-Host ""
Write-Host "[4/5] Migrating data from SQLite to MySQL..." -ForegroundColor Yellow
Write-Host "    This may take several minutes for large databases..." -ForegroundColor Gray
Write-Host ""

# Copy SQLite file to container if needed (in case it's not in mounted volume)
$containerSqlitePath = "/app/prisma/dev.db"

# Run migration script inside container
docker compose exec backend node migrate-sqlite-to-mysql.mjs $containerSqlitePath

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Migration failed!" -ForegroundColor Red
    Write-Host "Check the logs above for details." -ForegroundColor Yellow
    exit 1
}

# Verify migration
Write-Host ""
Write-Host "[5/5] Verifying migration..." -ForegroundColor Yellow
docker compose exec mysql mysql -u root -prootpassword quizzysmart -e "SELECT 'Users' as tbl, COUNT(*) as cnt FROM User UNION SELECT 'Questions', COUNT(*) FROM Question UNION SELECT 'KnowledgeBases', COUNT(*) FROM KnowledgeBase UNION SELECT 'Documents', COUNT(*) FROM documents UNION SELECT 'StudyPlans', COUNT(*) FROM StudyPlan UNION SELECT 'QuestionProgress', COUNT(*) FROM QuestionProgress;" 2>&1 | Select-String -NotMatch "Warning"

# Restart backend
Write-Host ""
Write-Host "Restarting backend container..." -ForegroundColor Yellow
docker compose restart backend | Out-Null
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "MIGRATION SUCCESSFUL!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Data has been migrated from SQLite to MySQL" -ForegroundColor White
Write-Host ""
Write-Host "Application URLs:" -ForegroundColor Yellow
Write-Host "  Frontend:   http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:    http://localhost:3000" -ForegroundColor White
Write-Host "  phpMyAdmin: http://localhost:8080" -ForegroundColor White
Write-Host ""
Write-Host "Note: Original SQLite file is preserved at: $SqliteFile" -ForegroundColor Gray
Write-Host ""
