# Frontend (Vite dev server) Dockerfile
FROM node:20-alpine

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

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
