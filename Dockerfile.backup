# Use official Node.js 18 Alpine image for smaller size and better performance
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install pnpm globally and production dependencies (now includes build tools)
RUN npm install -g pnpm && pnpm install --prod

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "server.js"]