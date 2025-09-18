#!/bin/bash

# Production Health Check Script for Jobber Reporting App
# This script performs comprehensive health checks on all system components

set -e

# Configuration
APP_URL="${APP_URL:-http://localhost:3000}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-jobber_reporting_prod}"
DB_USER="${DB_USER:-jobber_user}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379/1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Results
CHECKS_PASSED=0
CHECKS_FAILED=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((CHECKS_PASSED++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((CHECKS_FAILED++))
}

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local expected_code=${2:-200}
    local timeout=${3:-10}

    if curl -s --max-time $timeout -o /dev/null -w "%{http_code}" "$url" | grep -q "^$expected_code$"; then
        log_success "HTTP check passed: $url"
        return 0
    else
        log_error "HTTP check failed: $url (expected $expected_code)"
        return 1
    fi
}

# Function to check database connection
check_database() {
    if command -v psql >/dev/null 2>&1; then
        if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
            log_success "Database connection check passed"
            return 0
        else
            log_error "Database connection check failed"
            return 1
        fi
    else
        log_warning "psql not available, skipping database check"
        return 0
    fi
}

# Function to check Redis connection
check_redis() {
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
            log_success "Redis connection check passed"
            return 0
        else
            log_error "Redis connection check failed"
            return 1
        fi
    else
        log_warning "redis-cli not available, skipping Redis check"
        return 0
    fi
}

# Function to check disk space
check_disk_space() {
    local threshold=${1:-90}
    local usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

    if [ "$usage" -lt "$threshold" ]; then
        log_success "Disk space check passed (${usage}% used)"
        return 0
    else
        log_error "Disk space check failed (${usage}% used, threshold ${threshold}%)"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    local threshold=${1:-90}
    local usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')

    if [ "$usage" -lt "$threshold" ]; then
        log_success "Memory usage check passed (${usage}% used)"
        return 0
    else
        log_error "Memory usage check failed (${usage}% used, threshold ${threshold}%)"
        return 1
    fi
}

# Function to check process
check_process() {
    local process_name=$1
    local min_count=${2:-1}

    local count=$(pgrep -f "$process_name" | wc -l)

    if [ "$count" -ge "$min_count" ]; then
        log_success "Process check passed: $process_name ($count running)"
        return 0
    else
        log_error "Process check failed: $process_name (expected $min_count, found $count)"
        return 1
    fi
}

# Function to check SSL certificate
check_ssl() {
    local domain=$1

    if command -v openssl >/dev/null 2>&1; then
        local expiry=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        local expiry_epoch=$(date -d "$expiry" +%s 2>/dev/null)
        local now_epoch=$(date +%s)
        local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

        if [ "$days_left" -gt 30 ]; then
            log_success "SSL certificate check passed (${days_left} days remaining)"
            return 0
        elif [ "$days_left" -gt 7 ]; then
            log_warning "SSL certificate expires soon (${days_left} days remaining)"
            return 0
        else
            log_error "SSL certificate check failed (${days_left} days remaining)"
            return 1
        fi
    else
        log_warning "openssl not available, skipping SSL check"
        return 0
    fi
}

# Main health check function
main() {
    log_info "Starting production health checks..."
    log_info "Timestamp: $(date)"

    # Application Health Checks
    log_info "Checking application health..."
    check_http "$APP_URL/api/health" 200 5
    check_http "$APP_URL" 200 10

    # Database Health Checks
    log_info "Checking database health..."
    check_database

    # Redis Health Checks
    log_info "Checking Redis health..."
    check_redis

    # System Health Checks
    log_info "Checking system health..."
    check_disk_space 90
    check_memory 90

    # Process Health Checks
    log_info "Checking process health..."
    check_process "node.*server.js" 1
    check_process "nginx" 1
    check_process "postgres" 1
    check_process "redis" 1

    # SSL Health Checks (if domain is configured)
    if [ -n "$SSL_DOMAIN" ]; then
        log_info "Checking SSL certificate health..."
        check_ssl "$SSL_DOMAIN"
    fi

    # Summary
    echo
    log_info "Health check summary:"
    echo -e "${GREEN}Passed: $CHECKS_PASSED${NC}"
    echo -e "${RED}Failed: $CHECKS_FAILED${NC}"

    if [ "$CHECKS_FAILED" -eq 0 ]; then
        log_success "All health checks passed! ✅"
        exit 0
    else
        log_error "Some health checks failed! ❌"
        exit 1
    fi
}

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi