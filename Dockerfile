# Use official Node.js 18 Alpine image for smaller size and better performance
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./
COPY .npmrc ./

# Install dependencies with production-optimized settings
RUN npm ci --only=production --prefer-offline --no-audit --cache .npm

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "server.js"]