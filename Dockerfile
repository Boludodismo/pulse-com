# Multi-stage Dockerfile for POD CRM - Google Cloud Run compatible
# Fixes: uses corepack for pnpm, correct project structure, fixed PORT

# Stage 1: Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY package.json pnpm-lock.yaml ./
COPY client ./client
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY vitest.config.ts ./
COPY components.json ./
COPY drizzle.config.ts ./
COPY patches ./patches

# Build application
RUN pnpm run build

# Stage 3: Production
FROM node:22-alpine

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy server source (needed for runtime)
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/index.js"]
