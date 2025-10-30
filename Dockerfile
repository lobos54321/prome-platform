# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install pnpm and all dependencies (including devDependencies needed for build)
RUN npm install -g pnpm && pnpm install

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install pnpm and production dependencies only
RUN npm install -g pnpm && pnpm install --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy server and other necessary files
COPY server.js ./
COPY public ./public

# Expose port
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "server.js"]
