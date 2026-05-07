# Simple Dockerfile for Zeabur
FROM node:20-alpine

WORKDIR /app

# Install bash (required for build scripts)
RUN apk add --no-cache bash

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY . .

# Build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm build

# Expose port
EXPOSE 5000

ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

# Start
CMD ["pnpm", "start"]
