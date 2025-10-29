# Quick Start Script for RAG Testing

Write-Host "🚀 RAG System Quick Start" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path ".\server")) {
    Write-Host "❌ Error: Please run this script from the root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Step 1: Installing dependencies..." -ForegroundColor Yellow
Set-Location server
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "🔧 Step 2: Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated" -ForegroundColor Green
Write-Host ""

Write-Host "📁 Step 3: Creating uploads directory..." -ForegroundColor Yellow
if (-not (Test-Path ".\uploads")) {
    New-Item -ItemType Directory -Path ".\uploads" -Force | Out-Null
}
if (-not (Test-Path ".\uploads\documents")) {
    New-Item -ItemType Directory -Path ".\uploads\documents" -Force | Out-Null
}
Write-Host "✅ Upload directories created" -ForegroundColor Green
Write-Host ""

Write-Host "🔍 Step 4: Checking .env configuration..." -ForegroundColor Yellow
if (-not (Test-Path ".\.env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "   Please create .env file from .env.example" -ForegroundColor Yellow
    exit 1
}

# Check required env vars
$envContent = Get-Content ".\.env" -Raw
$requiredVars = @("QDRANT_URL", "QDRANT_API_KEY", "GEMINI_API_KEY")
$missingVars = @()

foreach ($var in $requiredVars) {
    if ($envContent -notmatch "$var=.+") {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "⚠️  Warning: Missing environment variables:" -ForegroundColor Yellow
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Yellow
    }
    Write-Host "   RAG features may not work correctly" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "✅ Environment variables configured" -ForegroundColor Green
    Write-Host ""
}

Set-Location ..

Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Open TWO terminal windows" -ForegroundColor White
Write-Host ""
Write-Host "   Terminal 1 - Backend:" -ForegroundColor Yellow
Write-Host "      cd server" -ForegroundColor Gray
Write-Host "      npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "   Terminal 2 - Frontend:" -ForegroundColor Yellow
Write-Host "      npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Login as admin" -ForegroundColor White
Write-Host "   3. Navigate to 'Quản lý Văn bản (RAG)'" -ForegroundColor White
Write-Host "   4. Upload PDF files!" -ForegroundColor White
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - RAG_TESTING_GUIDE.md" -ForegroundColor Gray
Write-Host "   - QDRANT_SETUP_GUIDE.md" -ForegroundColor Gray
Write-Host "   - RAG_IMPLEMENTATION_SUMMARY.md" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 Happy Testing!" -ForegroundColor Green
