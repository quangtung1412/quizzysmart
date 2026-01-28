# Backend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma (required for MySQL)
RUN apk add --no-cache openssl libc6-compat

# Copy package files for better layer caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client (skip migrations in build)
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src/
COPY scripts ./scripts/

# Build TypeScript (without prebuild hook)
RUN npx tsc -p tsconfig.json

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install OpenSSL, curl, wget, netcat for Prisma, healthcheck and entrypoint
RUN apk add --no-cache openssl curl wget libc6-compat netcat-openbsd mysql-client

# Copy package files
COPY package*.json ./

# Install production dependencies only + tsx for scripts
RUN npm ci --omit=dev && npm install tsx

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist/

# Copy scripts for admin tools
COPY scripts ./scripts/

# Copy migration and export scripts
COPY migrate-sqlite-to-mysql.mjs export-sqlite-to-sql.mjs ./

# Copy entrypoint script and fix line endings (Windows CRLF -> Unix LF)
COPY docker-entrypoint.sh /usr/local/bin/
RUN dos2unix /usr/local/bin/docker-entrypoint.sh || sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 3000

# Use custom entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
