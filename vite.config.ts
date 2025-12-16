import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // In Docker/Cloudflare tunnel setups, VITE_API_PROXY_TARGET is often injected as a runtime env var
  // (docker-compose `environment:`). `loadEnv` mainly reads from .env files, so also fall back to
  // process.env to ensure the proxy target is picked up.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000';
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    server: {
      host: '0.0.0.0', // Cho phép truy cập từ các địa chỉ IP khác
      port: 5173,
      allowedHosts: [
        'giadinhnhimsoc.site',
        'www.giadinhnhimsoc.site'
      ],
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        },
        // Socket.IO needs ws proxying when the tunnel only exposes the frontend (:5173)
        '/socket.io': {
          target: apiProxyTarget,
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
