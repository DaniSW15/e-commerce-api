# ====================
# Multi-stage Dockerfile for NestJS E-Commerce API
# Optimized for production with minimal image size
# ====================

# ============ Stage 1: Dependencies ============
FROM node:20-alpine AS dependencies
LABEL stage=dependencies

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --quiet

# ============ Stage 2: Build ============
FROM node:20-alpine AS build
LABEL stage=build

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build application
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# ============ Stage 3: Production ============
FROM node:20-alpine AS production

# Add build arguments
ARG NODE_ENV=production
ARG BUILD_DATE
ARG VERSION

# Set labels
LABEL maintainer="your-email@example.com"
LABEL version="${VERSION}"
LABEL build-date="${BUILD_DATE}"
LABEL description="E-Commerce API - Production Ready"

# Set environment variables
ENV NODE_ENV=${NODE_ENV}
ENV PORT=3000

WORKDIR /app

# Install only required system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy built application and production dependencies
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/package*.json ./

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/main.js"]
