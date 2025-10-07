# ---- Build stage ----
FROM node:22-slim AS builder
WORKDIR /app

# Install Prisma deps
RUN apt-get update -y && apt-get install -y --no-install-recommends \
  openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Build-time args
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ARG NEXT_PUBLIC_IMGPROXY_BASE
ARG NEXT_PUBLIC_S3_ENDPOINT
ARG NEXT_PUBLIC_S3_BUCKET
ARG NEXT_PUBLIC_GTM_ID

ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
ENV NEXT_PUBLIC_IMGPROXY_BASE=${NEXT_PUBLIC_IMGPROXY_BASE}
ENV NEXT_PUBLIC_S3_ENDPOINT=${NEXT_PUBLIC_S3_ENDPOINT}
ENV NEXT_PUBLIC_S3_BUCKET=${NEXT_PUBLIC_S3_BUCKET}
ENV NEXT_PUBLIC_GTM_ID=${NEXT_PUBLIC_GTM_ID}
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build   # must have next.config.js: { output: 'standalone' }

# Prune dev deps → production node_modules
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y --no-install-recommends \
  openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3004

# Copy build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma schema
COPY --from=builder /app/prisma ./prisma

# Copy production node_modules (incl. prisma CLI + deps)
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3004

# Run migrations then start Next.js
CMD npx prisma migrate deploy && node server.js