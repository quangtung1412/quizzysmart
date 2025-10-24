# Socket.IO Production Configuration

## Các thay đổi đã thực hiện

### 1. Server Configuration (server/src/index.ts)
- ✅ Thêm tất cả production domains vào CORS allowlist
- ✅ Thay đổi transport order: `['polling', 'websocket']` - polling trước để tránh timeout
- ✅ Tăng timeout values để phù hợp với mạng chậm
- ✅ Thêm logging chi tiết để debug

### 2. Client Configuration (src/socket.ts)
- ✅ Sử dụng `API_BASE` cho Socket.IO URL trong production
- ✅ Transport order: `['polling', 'websocket']` - polling trước
- ✅ Tăng reconnection attempts lên 10
- ✅ Tăng timeout lên 30s
- ✅ Thêm logging chi tiết với transport info

## Kiểm tra môi trường Production

### 1. Kiểm tra Server logs khi client kết nối:
```
[Socket.IO] Client connected: <socket-id>
[Socket.IO] Transport: polling
[Socket.IO] Address: <client-ip>
[Socket.IO] Headers: https://giadinhnhimsoc.site
```

### 2. Kiểm tra Browser Console (Client):
```
[Socket] Connecting to: <backend-url>
[Socket] Connected successfully!
[Socket] ID: <socket-id>
[Socket] Transport: polling
```

### 3. Nếu gặp lỗi Connection Error:
```
[Socket] Connection error: Error: timeout
[Socket] Error details: { message, type, description }
```

## Cấu hình Nginx (nếu dùng reverse proxy)

### Đảm bảo Nginx config hỗ trợ Socket.IO:

```nginx
# Backend API & Socket.IO
location /api/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Important for Socket.IO
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}

# Socket.IO endpoint
location /socket.io/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Socket.IO specific timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

## Environment Variables cần thiết

Trong file `.env` của server:

```bash
# Frontend URL (where your app is hosted)
FRONTEND_URL=https://giadinhnhimsoc.site

# Allowed origins (comma-separated)
ALLOWED_ORIGINS=https://giadinhnhimsoc.site,https://www.giadinhnhimsoc.site,http://13.229.10.40

# Node environment
NODE_ENV=production
```

## Troubleshooting

### Lỗi: "timeout" sau 20-30s
**Nguyên nhân:** Nginx/Firewall block WebSocket hoặc timeout quá ngắn
**Giải pháp:** 
- Kiểm tra Nginx config có hỗ trợ WebSocket
- Tăng timeout trong Nginx
- Client sẽ tự động fallback về polling

### Lỗi: "CORS error"
**Nguyên nhân:** Domain không trong allowlist
**Giải pháp:**
- Thêm domain vào `ALLOWED_ORIGINS` trong .env
- Restart server sau khi thay đổi

### Socket.IO không kết nối được
**Nguyên nhân:** API_BASE không đúng
**Giải pháp:**
- Kiểm tra browser console: `[Socket] Connecting to: <url>`
- Đảm bảo URL đó có thể access được
- Kiểm tra `VITE_API_BASE` trong build config

### Transport không upgrade lên WebSocket
**Nguyên nhân:** Nginx hoặc firewall block WebSocket
**Giải pháp:**
- Polling vẫn hoạt động tốt, không cần thiết phải dùng WebSocket
- Nếu muốn force WebSocket: Thay `transports: ['polling', 'websocket']` thành `transports: ['websocket']`

## Testing

### Test Socket.IO connection từ browser console:
```javascript
// Open browser console on your production site
const io = require('socket.io-client');
const socket = io(window.location.origin, {
    path: '/socket.io',
    transports: ['polling', 'websocket']
});

socket.on('connect', () => {
    console.log('Connected:', socket.id);
});

socket.on('connect_error', (err) => {
    console.error('Connection error:', err);
});
```

### Test từ command line:
```bash
# Test if Socket.IO endpoint responds
curl -X GET "https://giadinhnhimsoc.site/socket.io/?EIO=4&transport=polling"
```

## Monitoring

Theo dõi logs để đảm bảo Socket.IO hoạt động:

```bash
# Server logs
tail -f /var/log/your-app/server.log | grep "Socket.IO"

# Nginx logs
tail -f /var/log/nginx/access.log | grep "socket.io"
```

## Performance Tips

1. **Polling vs WebSocket:**
   - Polling: Tương thích tốt hơn, ít bị block
   - WebSocket: Hiệu năng tốt hơn khi đã kết nối
   - Current config: Start với polling, upgrade to WebSocket khi có thể

2. **Connection Pooling:**
   - Giới hạn số connections per user nếu cần
   - Current: Unlimited connections

3. **Room Management:**
   - User joins room `user:{userId}` để nhận thông báo riêng
   - Force-logout event gửi đến room này

## Status

✅ Socket.IO server configured với polling-first strategy
✅ Client configured to use same backend as API
✅ CORS configured for all production domains
✅ Extensive logging for debugging
✅ Auto-reconnection with 10 attempts
✅ 30s timeout for slow networks

**Next Steps:**
1. Deploy code lên production server
2. Restart server
3. Test connection từ production frontend
4. Kiểm tra logs để đảm bảo connection thành công
