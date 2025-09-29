# Use official Node.js 18 Alpine image for smaller size and better performance
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install pnpm globally and all dependencies (including devDependencies for build)
RUN npm install -g pnpm && pnpm install

# Copy source code
COPY . .

# Build the application (this needs devDependencies like vite)
RUN pnpm run build

# Clean up devDependencies after build to reduce image size
RUN pnpm prune --prod

# Expose port
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "server.js"]