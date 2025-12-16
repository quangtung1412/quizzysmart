# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and config files
COPY tsconfig.json vite.config.ts tailwind.config.cjs postcss.config.cjs index.html index.tsx ./
COPY src ./src/
COPY components ./components/
COPY public ./public/
COPY App.tsx AppWithRouter.tsx types.ts metadata.json ./

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
