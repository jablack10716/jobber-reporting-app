#!/bin/bash

# Production Monitoring Script for Jobber Reporting App
# This script runs periodic health checks and sends alerts if needed

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
HEALTH_CHECK_SCRIPT="$SCRIPT_DIR/health-check.sh"
LOG_FILE="$PROJECT_ROOT/logs/monitoring.log"
ALERT_EMAIL="${ALERT_EMAIL:-admin@yourdomain.com}"
SMTP_SERVER="${SMTP_SERVER:-localhost}"

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    echo -e "${!level}[$level]${NC} $message"
}

# Alert function
send_alert() {
    local subject=$1
    local message=$2

    log "ERROR" "Sending alert: $subject"

    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
    elif command -v sendmail >/dev/null 2>&1; then
        echo "Subject: $subject
$message" | sendmail "$ALERT_EMAIL"
    else
        log "WARNING" "No email client available for alerts"
    fi
}

# Function to check service status
check_service() {
    local service=$1
    local process_pattern=$2

    if pgrep -f "$process_pattern" >/dev/null; then
        log "INFO" "Service $service is running"
        return 0
    else
        log "ERROR" "Service $service is not running"
        send_alert "Service Down: $service" "The $service service is not running on $(hostname) at $(date)"
        return 1
    fi
}

# Function to check disk usage
check_disk_usage() {
    local threshold=${1:-90}
    local usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

    if [ "$usage" -gt "$threshold" ]; then
        log "ERROR" "Disk usage is ${usage}%, threshold is ${threshold}%"
        send_alert "High Disk Usage" "Disk usage is ${usage}% on $(hostname) at $(date)"
        return 1
    else
        log "INFO" "Disk usage is ${usage}%"
        return 0
    fi
}

# Function to check memory usage
check_memory_usage() {
    local threshold=${1:-90}
    local usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')

    if [ "$usage" -gt "$threshold" ]; then
        log "ERROR" "Memory usage is ${usage}%, threshold is ${threshold}%"
        send_alert "High Memory Usage" "Memory usage is ${usage}% on $(hostname) at $(date)"
        return 1
    else
        log "INFO" "Memory usage is ${usage}%"
        return 0
    fi
}

# Function to backup logs
backup_logs() {
    local backup_dir="$PROJECT_ROOT/backups/logs"
    mkdir -p "$backup_dir"

    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$backup_dir/logs_$timestamp.tar.gz"

    if tar -czf "$backup_file" -C "$PROJECT_ROOT" logs/ 2>/dev/null; then
        log "INFO" "Logs backed up to $backup_file"

        # Clean old backups (keep last 7 days)
        find "$backup_dir" -name "logs_*.tar.gz" -mtime +7 -delete
    else
        log "WARNING" "Failed to backup logs"
    fi
}

# Function to rotate logs
rotate_logs() {
    local max_size=${1:-10485760}  # 10MB default

    if [ -f "$LOG_FILE" ] && [ "$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null)" -gt "$max_size" ]; then
        local backup_log="$LOG_FILE.$(date '+%Y%m%d_%H%M%S')"
        mv "$LOG_FILE" "$backup_log"
        log "INFO" "Log rotated to $backup_log"

        # Compress old log files
        if command -v gzip >/dev/null 2>&1; then
            gzip "$backup_log"
        fi

        # Clean old rotated logs (keep last 5)
        ls -t "$LOG_FILE".* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    fi
}

# Main monitoring function
main() {
    log "INFO" "Starting monitoring cycle"

    local errors=0

    # Rotate logs if needed
    rotate_logs

    # Run comprehensive health check
    if [ -f "$HEALTH_CHECK_SCRIPT" ]; then
        if ! bash "$HEALTH_CHECK_SCRIPT" >> "$LOG_FILE" 2>&1; then
            ((errors++))
            log "ERROR" "Health check failed"
        else
            log "INFO" "Health check passed"
        fi
    else
        log "WARNING" "Health check script not found: $HEALTH_CHECK_SCRIPT"
    fi

    # Check critical services
    check_service "Node.js App" "node.*server.js" || ((errors++))
    check_service "nginx" "nginx" || ((errors++))
    check_service "PostgreSQL" "postgres" || ((errors++))
    check_service "Redis" "redis" || ((errors++))

    # Check system resources
    check_disk_usage 90 || ((errors++))
    check_memory_usage 90 || ((errors++))

    # Backup logs (daily at midnight)
    if [ "$(date '+%H%M')" = "0000" ]; then
        backup_logs
    fi

    # Summary
    if [ "$errors" -eq 0 ]; then
        log "INFO" "Monitoring cycle completed successfully"
    else
        log "ERROR" "Monitoring cycle completed with $errors errors"
        send_alert "Monitoring Alert" "Monitoring detected $errors issues on $(hostname) at $(date). Check logs for details."
    fi
}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi