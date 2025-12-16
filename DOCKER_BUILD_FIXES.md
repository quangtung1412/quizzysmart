# Docker Build Fixes - Summary

## Lỗi đã sửa

### 1. Frontend Build Issues
**Lỗi**: Missing files in Docker build context
**File**: `Dockerfile`
**Sửa**: Thêm copy các file cần thiết:
- `index.tsx` - Entry point
- `App.tsx`, `AppWithRouter.tsx` - Main components  
- `types.ts`, `metadata.json` - Type definitions và metadata

### 2. Backend Prisma OpenSSL Issues
**Lỗi**: Prisma không tìm thấy OpenSSL trong Alpine Linux
```
prisma:warn Prisma failed to detect the libssl/openssl version
```
**File**: `server/Dockerfile`
**Sửa**: 
- Cài OpenSSL trong cả builder và production stages
- `RUN apk add --no-cache openssl`

### 3. Build Process Migration Issues
**Lỗi**: `npm run build` chạy `prebuild` hook với `prisma migrate deploy` (không thể migrate trong build stage)
**File**: `server/Dockerfile`
**Sửa**:
- Dùng `npx tsc -p tsconfig.json` thay vì `npm run build`
- Chỉ run `prisma generate` trong build stage
- Migrate chỉ chạy khi container start (CMD)

### 4. TypeScript Strict Null Checks
**Lỗi**: 
```typescript
error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'
```
**Files**: 
- `server/src/services/query-preprocessor.service.ts` (line 285)
- `server/src/services/unified-query-processor.service.ts` (line 258)

**Sửa**: Thêm null check cho cache management:
```typescript
const firstKey = this.cache.keys().next().value;
if (firstKey) {
    this.cache.delete(firstKey);
}
```

### 5. Docker Compose Version Warning
**Lỗi**: `version` attribute is obsolete in docker-compose.yml
**File**: `docker-compose.yml`
**Sửa**: Xóa `version: '3.8'` (không cần trong Docker Compose V2)

### 6. TypeScript Configuration
**File**: `server/tsconfig.json`
**Sửa**: Thêm paths mapping và exclude để build tốt hơn:
```json
{
  "paths": {
    "@prisma/client": ["./node_modules/@prisma/client"]
  },
  "exclude": ["node_modules", "dist"]
}
```

## Checklist Trước Build

✅ TypeScript compilation successful (0 errors)
✅ Prisma client generated
✅ OpenSSL installed in Dockerfile
✅ All source files included in Docker context
✅ Migration separated from build process

## Build Commands

```powershell
# Test TypeScript compilation
cd server
npx tsc --noEmit

# Build Docker images
cd ..
docker compose build

# Run containers
docker compose up -d
```

## Files Changed

1. `Dockerfile` - Frontend build fixes
2. `server/Dockerfile` - Backend OpenSSL, build process
3. `server/tsconfig.json` - TypeScript config improvements
4. `server/src/services/query-preprocessor.service.ts` - Null check fix
5. `server/src/services/unified-query-processor.service.ts` - Null check fix
6. `docker-compose.yml` - Remove obsolete version

## Next Steps

Sau khi build thành công:
1. Kiểm tra containers: `docker compose ps`
2. Xem logs: `docker compose logs -f`
3. Test endpoints:
   - Frontend: http://localhost
   - Backend healthcheck: http://localhost:3000/api/healthcheck
4. Tạo admin user: `docker compose exec backend sh` → `npm run create-admin`
