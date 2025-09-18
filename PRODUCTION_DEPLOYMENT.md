# Production Deployment Guide for Jobber Reporting App

## Overview

This guide provides step-by-step instructions for deploying the Jobber Reporting App to production. The application consists of a Node.js/Express backend and a React frontend, with support for PostgreSQL database and Redis caching.

## Prerequisites

### System Requirements
- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **Memory**: 2GB RAM minimum, 4GB recommended
- **Storage**: 10GB available space
- **Network**: Public IP with domain name

### Software Requirements
- **Node.js**: 18.x LTS
- **PostgreSQL**: 15.x
- **Redis**: 7.x
- **nginx**: Latest stable
- **Docker**: 20.x+ (optional, for containerized deployment)
- **SSL Certificate**: From Let's Encrypt or commercial CA

### Domain and DNS
- Registered domain name
- DNS A record pointing to your server IP
- SSL certificate for HTTPS

## Quick Start (Automated)

### Option 1: Automated Build Script

```bash
# Clone the repository
git clone <your-repo-url>
cd jobber-reporting-app

# Run the automated build script
chmod +x scripts/build-production.sh
./scripts/build-production.sh
```

This script will:
- Install dependencies
- Build the frontend
- Prepare the backend
- Validate the build
- Create a deployment package

### Option 2: Docker Deployment

```bash
# Build and start services
docker-compose -f docker-compose.production.yml up -d

# Or use the build script with Docker
./scripts/build-production.sh --docker
```

## Manual Deployment

### Step 1: Environment Setup

1. **Create Production Environment File**
   ```bash
   cp backend/.env.production backend/.env
   ```

2. **Configure Environment Variables**
   Edit `backend/.env` and update all placeholder values:

   ```bash
   # Jobber OAuth (get from Jobber Developer Console)
   JOBBER_CLIENT_ID=your_actual_client_id
   JOBBER_CLIENT_SECRET=your_actual_client_secret
   JOBBER_REDIRECT_URI=https://yourdomain.com/auth/callback

   # Database
   DATABASE_HOST=localhost
   DATABASE_PASSWORD=your_secure_db_password

   # Redis
   REDIS_URL=redis://localhost:6379/1

   # Security
   SESSION_SECRET=your_256_bit_session_secret
   ADMIN_KEY=your_secure_admin_key

   # Domain
   CLIENT_APP_ORIGIN=https://yourdomain.com
   ```

### Step 2: Database Setup

1. **Install PostgreSQL**
   ```bash
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   ```

2. **Create Database and User**
   ```bash
   sudo -u postgres psql
   CREATE DATABASE jobber_reporting_prod;
   CREATE USER jobber_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE jobber_reporting_prod TO jobber_user;
   \q
   ```

3. **Configure PostgreSQL**
   Edit `/etc/postgresql/15/main/pg_hba.conf`:
   ```
   # Allow local connections
   local   jobber_reporting_prod   jobber_user   md5
   ```

   Restart PostgreSQL:
   ```bash
   sudo systemctl restart postgresql
   ```

### Step 3: Redis Setup

1. **Install Redis**
   ```bash
   sudo apt install redis-server
   ```

2. **Configure Redis**
   Edit `/etc/redis/redis.conf`:
   ```
   requirepass your_redis_password
   ```

3. **Start Redis**
   ```bash
   sudo systemctl start redis-server
   sudo systemctl enable redis-server
   ```

### Step 4: Application Deployment

1. **Install Dependencies**
   ```bash
   cd backend
   npm ci --production
   ```

2. **Build Frontend**
   ```bash
   cd ../frontend
   npm ci
   npm run build
   cp -r build ../backend/
   ```

3. **Create Required Directories**
   ```bash
   cd ../backend
   mkdir -p data logs backups
   ```

4. **Start Application**
   ```bash
   # Test startup
   node server.js

   # Production startup (using PM2 recommended)
   npm install -g pm2
   pm2 start server.js --name jobber-app
   pm2 startup
   pm2 save
   ```

### Step 5: Web Server Configuration

1. **Install nginx**
   ```bash
   sudo apt install nginx
   ```

2. **Configure nginx**
   Copy the nginx configuration:
   ```bash
   sudo cp nginx/nginx.conf /etc/nginx/nginx.conf
   ```

   Update the configuration with your domain:
   ```bash
   sudo sed -i 's/yourdomain.com/your.actual.domain.com/g' /etc/nginx/nginx.conf
   ```

3. **SSL Certificate Setup**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

4. **Start nginx**
   ```bash
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

## Security Configuration

### SSL/TLS Setup
- Use Let's Encrypt for free SSL certificates
- Configure HSTS headers
- Disable weak SSL protocols

### Firewall Configuration
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000  # For direct app access if needed
```

### Application Security
- Keep dependencies updated
- Use strong passwords
- Rotate API keys regularly
- Monitor for security vulnerabilities

## Monitoring and Maintenance

### Health Checks
The application includes built-in health checks:
- `/api/health` - Application health
- `/health` - nginx health check

### Logging
- Application logs: `backend/logs/app.log`
- nginx logs: `/var/log/nginx/`
- System logs: `journalctl`

### Backup Strategy
```bash
# Database backup
pg_dump jobber_reporting_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Application data backup
tar -czf app_backup_$(date +%Y%m%d_%H%M%S).tar.gz backend/data/
```

### Monitoring Setup
Consider setting up:
- **PM2 Monitoring**: `pm2 monit`
- **nginx Monitoring**: Access logs analysis
- **Database Monitoring**: PostgreSQL logs
- **Uptime Monitoring**: External service monitoring

## Troubleshooting

### Common Issues

1. **Application Won't Start**
   - Check environment variables
   - Verify database connection
   - Check logs: `pm2 logs jobber-app`

2. **Database Connection Failed**
   - Verify PostgreSQL is running
   - Check connection credentials
   - Test connection: `psql -h localhost -U jobber_user -d jobber_reporting_prod`

3. **Redis Connection Failed**
   - Verify Redis is running
   - Check Redis password
   - Test connection: `redis-cli -a your_password ping`

4. **nginx Configuration Issues**
   - Test configuration: `sudo nginx -t`
   - Check error logs: `sudo tail -f /var/log/nginx/error.log`
   - Verify SSL certificates

### Performance Tuning

1. **Node.js Optimization**
   ```bash
   export NODE_ENV=production
   export NODE_OPTIONS="--max-old-space-size=2048"
   ```

2. **Database Optimization**
   - Configure connection pooling
   - Set up proper indexes
   - Monitor query performance

3. **Cache Optimization**
   - Configure Redis memory limits
   - Set up cache invalidation policies

## Scaling Considerations

### Horizontal Scaling
- Use load balancer for multiple app instances
- Shared Redis for session storage
- Database read replicas

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Implement caching strategies

## Support and Maintenance

### Regular Maintenance Tasks
- Update dependencies monthly
- Rotate logs weekly
- Backup data daily
- Monitor performance metrics

### Emergency Contacts
- System Administrator: [contact]
- Database Administrator: [contact]
- Security Team: [contact]

---

## Deployment Checklist

### Pre-Deployment
- [ ] Domain name registered and DNS configured
- [ ] SSL certificate obtained
- [ ] Server security hardened
- [ ] Backup strategy implemented

### Environment Setup
- [ ] Production environment variables configured
- [ ] Database created and configured
- [ ] Redis installed and secured
- [ ] Application dependencies installed

### Application Deployment
- [ ] Frontend built and deployed
- [ ] Backend deployed and tested
- [ ] nginx configured and running
- [ ] SSL certificates installed

### Security Verification
- [ ] HTTPS enabled and working
- [ ] Security headers configured
- [ ] Firewall rules applied
- [ ] Sensitive data encrypted

### Monitoring Setup
- [ ] Health checks configured
- [ ] Logging enabled
- [ ] Monitoring alerts set up
- [ ] Backup automation configured

### Post-Deployment
- [ ] Application accessible via domain
- [ ] OAuth flow working correctly
- [ ] Database connections verified
- [ ] Performance tested

For additional support or questions, refer to the project documentation or contact the development team.