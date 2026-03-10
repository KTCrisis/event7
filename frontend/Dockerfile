# ============================================
# event7 Frontend — Next.js Standalone
# Placement: frontend/Dockerfile
# ============================================
# Build:  docker build -t event7-frontend .
# Run:    docker run -p 3000:3000 event7-frontend
# ============================================
# Note: This Dockerfile uses output: 'standalone' mode.
#       For Cloudflare Pages deployment, use the OpenNext workflow instead.
# ============================================

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --ignore-scripts

# --- Stage 2: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Inject standalone output mode for Docker/GKE builds
# This avoids modifying next.config.ts for Cloudflare compatibility
RUN sed -i 's/const nextConfig: NextConfig = {/const nextConfig: NextConfig = {\n  output: "standalone",/' next.config.ts

# Build-time env vars (API URL will differ per environment)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build
RUN npm run build

# --- Stage 3: Runtime ---
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user
RUN addgroup --system --gid 1001 event7 \
    && adduser --system --uid 1001 event7

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Own files
RUN chown -R event7:event7 /app
USER event7

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
