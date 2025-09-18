#!/bin/bash

# Production Build and Deployment Script for Jobber Reporting App
# This script handles the complete production build and deployment process

set -e  # Exit on any error

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BUILD_DIR="$BACKEND_DIR/build"
DIST_DIR="$BACKEND_DIR/dist"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    if ! command_exists node; then
        log_error "Node.js is not installed. Please install Node.js 16+ first."
        exit 1
    fi

    local node_version=$(node -v | sed 's/v//')
    local major_version=$(echo $node_version | cut -d. -f1)

    if [ "$major_version" -lt 16 ]; then
        log_error "Node.js version 16+ is required. Current version: $node_version"
        exit 1
    fi

    log_success "Node.js version: $node_version"
}

# Function to check npm version
check_npm_version() {
    if ! command_exists npm; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi

    local npm_version=$(npm -v)
    log_success "npm version: $npm_version"
}

# Function to install backend dependencies
install_backend_deps() {
    log_info "Installing backend dependencies..."
    cd "$BACKEND_DIR"

    if [ -f "package-lock.json" ]; then
        npm ci --production=false
    else
        npm install
    fi

    log_success "Backend dependencies installed"
}

# Function to install frontend dependencies
install_frontend_deps() {
    log_info "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"

    if [ -f "package-lock.json" ]; then
        npm ci --production=false
    else
        npm install
    fi

    log_success "Frontend dependencies installed"
}

# Function to build frontend
build_frontend() {
    log_info "Building frontend for production..."
    cd "$FRONTEND_DIR"

    # Set production environment variables
    export REACT_APP_API_URL="${REACT_APP_API_URL:-https://yourdomain.com}"
    export REACT_APP_VERSION="${REACT_APP_VERSION:-1.0.0}"
    export NODE_ENV=production

    npm run build

    log_success "Frontend built successfully"
}

# Function to prepare backend for production
prepare_backend() {
    log_info "Preparing backend for production..."

    # Create necessary directories
    mkdir -p "$BUILD_DIR"
    mkdir -p "$BACKEND_DIR/data"
    mkdir -p "$BACKEND_DIR/logs"
    mkdir -p "$BACKEND_DIR/backups"

    # Copy frontend build to backend
    if [ -d "$FRONTEND_DIR/build" ]; then
        log_info "Copying frontend build to backend..."
        cp -r "$FRONTEND_DIR/build/"* "$BUILD_DIR/"
        log_success "Frontend build copied"
    else
        log_warning "Frontend build directory not found. Make sure to build frontend first."
    fi

    # Copy production configuration
    if [ -f "$BACKEND_DIR/.env.production" ]; then
        log_info "Setting up production environment..."
        cp "$BACKEND_DIR/.env.production" "$BACKEND_DIR/.env"
        log_success "Production environment configured"
    else
        log_warning "Production environment file (.env.production) not found."
        log_warning "Please create it with your production credentials."
    fi

    log_success "Backend prepared for production"
}

# Function to run production tests
run_tests() {
    log_info "Running production tests..."

    # Backend tests
    cd "$BACKEND_DIR"
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        log_info "Running backend tests..."
        npm test || {
            log_error "Backend tests failed"
            exit 1
        }
        log_success "Backend tests passed"
    fi

    # Frontend tests
    cd "$FRONTEND_DIR"
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        log_info "Running frontend tests..."
        npm run test -- --watchAll=false --passWithNoTests || {
            log_error "Frontend tests failed"
            exit 1
        }
        log_success "Frontend tests passed"
    fi
}

# Function to validate production build
validate_build() {
    log_info "Validating production build..."

    # Check if build directory exists
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory does not exist: $BUILD_DIR"
        exit 1
    fi

    # Check for essential files
    local essential_files=(
        "$BUILD_DIR/index.html"
        "$BUILD_DIR/static/js/main.js"
        "$BUILD_DIR/static/css/main.css"
    )

    for file in "${essential_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Essential file missing: $file"
            exit 1
        fi
    done

    # Check backend files
    local backend_files=(
        "$BACKEND_DIR/server.js"
        "$BACKEND_DIR/package.json"
    )

    for file in "${backend_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Essential backend file missing: $file"
            exit 1
        fi
    done

    log_success "Production build validation passed"
}

# Function to create deployment package
create_deployment_package() {
    log_info "Creating deployment package..."

    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local package_name="jobber-reporting-app_$timestamp.tar.gz"
    local temp_dir=$(mktemp -d)

    # Copy necessary files
    mkdir -p "$temp_dir/app"
    cp -r "$BACKEND_DIR"/* "$temp_dir/app/"
    cp -r "$FRONTEND_DIR/build" "$temp_dir/app/build/" 2>/dev/null || true

    # Remove unnecessary files
    cd "$temp_dir/app"
    rm -rf node_modules .git *.log .env.local .env.development
    find . -name "*.test.js" -delete
    find . -name "*.test.tsx" -delete

    # Create archive
    cd "$temp_dir"
    tar -czf "$PROJECT_ROOT/$package_name" "app/"

    # Cleanup
    rm -rf "$temp_dir"

    log_success "Deployment package created: $package_name"
    echo "Package location: $PROJECT_ROOT/$package_name"
}

# Function to show deployment instructions
show_deployment_instructions() {
    cat << 'EOF'

================================================================================
🎉 PRODUCTION BUILD COMPLETED SUCCESSFULLY!
================================================================================

Next Steps for Deployment:

1. ENVIRONMENT SETUP:
   - Copy .env.production to your production server
   - Update all placeholder values with real production credentials
   - Ensure all required environment variables are set

2. SERVER DEPLOYMENT:
   - Upload the deployment package to your production server
   - Extract the archive: tar -xzf jobber-reporting-app_*.tar.gz
   - Navigate to the app directory: cd app
   - Install production dependencies: npm ci --production
   - Start the server: npm start

3. WEB SERVER CONFIGURATION (nginx example):
   server {
       listen 80;
       server_name yourdomain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name yourdomain.com;

       ssl_certificate /path/to/ssl/cert.pem;
       ssl_certificate_key /path/to/ssl/private.key;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }

4. SSL CERTIFICATE:
   - Obtain SSL certificate from Let's Encrypt or your CA
   - Configure HTTPS redirection
   - Update CORS origins in production config

5. MONITORING:
   - Set up log rotation
   - Configure monitoring alerts
   - Set up backup procedures

6. SECURITY CHECKLIST:
   - [ ] Environment variables are set correctly
   - [ ] SSL certificate is valid
   - [ ] Firewall is configured
   - [ ] Database is secured
   - [ ] Admin keys are rotated regularly

For detailed configuration options, see:
- backend/.env.production (environment variables)
- backend/config/production.js (server configuration)
- README.md (deployment guide)

================================================================================
EOF
}

# Main build function
main() {
    log_info "Starting production build process..."
    log_info "Project root: $PROJECT_ROOT"

    # Pre-build checks
    check_node_version
    check_npm_version

    # Install dependencies
    install_backend_deps
    install_frontend_deps

    # Run tests (optional, uncomment if needed)
    # run_tests

    # Build process
    build_frontend
    prepare_backend

    # Validation
    validate_build

    # Create deployment package
    create_deployment_package

    # Show success message and instructions
    show_deployment_instructions

    log_success "Production build completed successfully! 🚀"
}

# Run main function with error handling
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    trap 'log_error "Build failed with exit code $?"' ERR
    main "$@"
fi