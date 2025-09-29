#!/bin/bash

# ProMe Platform Deployment Script
# This script helps deploy the ProMe platform to various environments

set -e  # Exit on any error

echo "🚀 ProMe Platform Deployment Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        log_error "PNPM is not installed. Installing PNPM..."
        npm install -g pnpm
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version $NODE_VERSION is not supported. Please upgrade to Node.js 18+"
        exit 1
    fi
    
    log_success "Dependencies check passed"
}

# Setup environment variables
setup_env() {
    log_info "Setting up environment variables..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_warning "Created .env file from .env.example template"
            log_warning "Please update .env file with your actual configuration values"
        else
            log_error ".env.example file not found"
            exit 1
        fi
    else
        log_success "Environment file already exists"
    fi
    
    # Check critical environment variables
    source .env 2>/dev/null || true
    
    if [ -z "$VITE_DIFY_API_KEY" ] || [ "$VITE_DIFY_API_KEY" = "your_dify_api_key_here" ]; then
        log_warning "VITE_DIFY_API_KEY not configured in .env file"
    fi
    
    if [ -z "$VITE_SUPABASE_URL" ] || [ "$VITE_SUPABASE_URL" = "your_supabase_url_here" ]; then
        log_warning "VITE_SUPABASE_URL not configured in .env file"
    fi
}

# Install dependencies
install_deps() {
    log_info "Installing dependencies..."
    pnpm install
    log_success "Dependencies installed successfully"
}

# Build the application
build_app() {
    log_info "Building application for production..."
    pnpm run build
    log_success "Application built successfully"
}

# Start development servers
start_dev() {
    log_info "Starting development servers..."
    log_info "Frontend dev server will start on http://localhost:5173"
    log_info "Backend API server will start on http://localhost:8080"
    log_info "Chat interface available at: http://localhost:8080/chat/dify"
    
    # Start backend server in background
    node server.js &
    BACKEND_PID=$!
    
    # Start frontend dev server
    pnpm run dev &
    FRONTEND_PID=$!
    
    # Wait for user to stop
    log_success "Development servers started successfully"
    log_info "Press Ctrl+C to stop both servers"
    
    # Cleanup on exit
    trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
    wait
}

# Start production server
start_prod() {
    log_info "Starting production server..."
    
    # Check if build exists
    if [ ! -d "dist" ]; then
        log_warning "Build directory not found, building application first..."
        build_app
    fi
    
    log_info "Production server will start on port ${PORT:-8080}"
    log_info "Chat interface available at: http://localhost:${PORT:-8080}/chat/dify"
    
    node server.js
}

# Health check
health_check() {
    log_info "Performing health check..."
    
    PORT=${PORT:-8080}
    
    # Check if server is running
    if curl -f -s "http://localhost:$PORT/api/health" > /dev/null; then
        log_success "Server is healthy and responding"
        
        # Check API endpoint
        RESPONSE=$(curl -s "http://localhost:$PORT/api/health")
        echo "Health check response: $RESPONSE"
    else
        log_error "Server is not responding on port $PORT"
        exit 1
    fi
}

# Clean up build artifacts and node_modules
clean() {
    log_info "Cleaning up build artifacts..."
    
    rm -rf dist/
    rm -rf node_modules/
    rm -rf .vite/
    
    log_success "Cleanup completed"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup     - Check dependencies and setup environment"
    echo "  dev       - Start development servers"
    echo "  build     - Build for production"
    echo "  start     - Start production server"
    echo "  health    - Perform health check"
    echo "  clean     - Clean build artifacts"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup     # First-time setup"
    echo "  $0 dev       # Start development"
    echo "  $0 build     # Build for production"
    echo "  $0 start     # Start production server"
}

# Main script logic
case "${1:-help}" in
    "setup")
        check_dependencies
        setup_env
        install_deps
        log_success "Setup completed successfully!"
        log_info "Run '$0 dev' to start development servers"
        ;;
    "dev")
        check_dependencies
        setup_env
        install_deps
        start_dev
        ;;
    "build")
        check_dependencies
        setup_env
        install_deps
        build_app
        ;;
    "start")
        check_dependencies
        setup_env
        start_prod
        ;;
    "health")
        health_check
        ;;
    "clean")
        clean
        ;;
    "help"|*)
        show_usage
        ;;
esac