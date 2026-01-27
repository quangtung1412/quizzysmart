# ============================================
# MySQL Database Restore Script
# ============================================
# Restore database MySQL tu file SQL backup

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [switch]$Force
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "MySQL Database Restore" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check backup file exists
if (-not (Test-Path $BackupFile)) {
    Write-Host "ERROR: Backup file not found: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[1/5] Checking backup file..." -ForegroundColor Yellow
$fileSize = (Get-Item $BackupFile).Length
$fileSizeMB = [Math]::Round($fileSize/1MB, 2)
Write-Host "    File: $BackupFile" -ForegroundColor Gray
Write-Host "    Size: $fileSizeMB MB" -ForegroundColor Gray

# Check if compressed
$isZip = $BackupFile -match '\.zip$'
$sqlFile = $BackupFile

if ($isZip) {
    Write-Host ""
    Write-Host "[2/5] Extracting backup..." -ForegroundColor Yellow
    $tempDir = "temp_restore_" + (Get-Date -Format "yyyyMMddHHmmss")
    Expand-Archive -Path $BackupFile -DestinationPath $tempDir -Force
    $sqlFile = Get-ChildItem $tempDir -Filter "*.sql" | Select-Object -First 1 -ExpandProperty FullName
    if (-not $sqlFile) {
        Write-Host "ERROR: No SQL file found in ZIP!" -ForegroundColor Red
        Remove-Item $tempDir -Recurse -Force
        exit 1
    }
    Write-Host "    Extracted: $sqlFile" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[2/5] Skipping extraction (not compressed)" -ForegroundColor Yellow
}

# Check MySQL container
Write-Host ""
Write-Host "[3/5] Checking MySQL container..." -ForegroundColor Yellow
$mysqlStatus = docker compose ps mysql --format json | ConvertFrom-Json
if ($mysqlStatus.State -ne "running") {
    Write-Host "ERROR: MySQL container is not running!" -ForegroundColor Red
    if ($isZip) { Remove-Item $tempDir -Recurse -Force }
    exit 1
}
Write-Host "    MySQL is running!" -ForegroundColor Green

# Warning
if (-not $Force) {
    Write-Host ""
    Write-Host "WARNING: This will DROP and recreate the database!" -ForegroundColor Red
    Write-Host "         All current data will be LOST!" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Type 'yes' to continue"
    if ($confirm -ne "yes") {
        Write-Host "Restore cancelled." -ForegroundColor Yellow
        if ($isZip) { Remove-Item $tempDir -Recurse -Force }
        exit 0
    }
}

# Restore database
Write-Host ""
Write-Host "[4/5] Restoring database..." -ForegroundColor Yellow
Write-Host "    This may take a few minutes..." -ForegroundColor Gray

Get-Content $sqlFile | docker compose exec -T mysql mysql -u root -prootpassword 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Restore failed!" -ForegroundColor Red
    if ($isZip) { Remove-Item $tempDir -Recurse -Force }
    exit 1
}

Write-Host "    Database restored!" -ForegroundColor Green

# Cleanup
if ($isZip) {
    Remove-Item $tempDir -Recurse -Force
    Write-Host "    Cleaned up temporary files" -ForegroundColor Gray
}

# Verify restore
Write-Host ""
Write-Host "[5/5] Verifying restore..." -ForegroundColor Yellow
$counts = docker compose exec mysql mysql -u root -prootpassword quizzysmart -e "SELECT 'Users' as tbl, COUNT(*) as cnt FROM User UNION SELECT 'Questions', COUNT(*) FROM Question UNION SELECT 'KnowledgeBases', COUNT(*) FROM KnowledgeBase;" 2>&1 | Select-String -Pattern '\d+$'

if ($counts) {
    Write-Host "    Data verification:" -ForegroundColor Green
    docker compose exec mysql mysql -u root -prootpassword quizzysmart -e "SELECT 'Users' as tbl, COUNT(*) as cnt FROM User UNION SELECT 'Questions', COUNT(*) FROM Question UNION SELECT 'KnowledgeBases', COUNT(*) FROM KnowledgeBase UNION SELECT 'Documents', COUNT(*) FROM documents UNION SELECT 'StudyPlans', COUNT(*) FROM StudyPlan;" 2>&1 | Select-String -NotMatch "Warning"
}

# Restart backend to refresh connection
Write-Host ""
Write-Host "Restarting backend container..." -ForegroundColor Yellow
docker compose restart backend | Out-Null
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "RESTORE SUCCESSFUL!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database has been restored from: $BackupFile" -ForegroundColor White
Write-Host ""
Write-Host "Application URLs:" -ForegroundColor Yellow
Write-Host "  Frontend:   http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:    http://localhost:3000" -ForegroundColor White
Write-Host "  phpMyAdmin: http://localhost:8080" -ForegroundColor White
Write-Host ""
