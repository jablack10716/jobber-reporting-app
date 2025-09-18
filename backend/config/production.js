// Production server configuration
// This file contains production-specific server settings and middleware

const productionConfig = {
  // Server Configuration
  port: process.env.PORT || 3000,
  host: process.env.HOST || '0.0.0.0',
  environment: 'production',

  // Security Configuration
  security: {
    // HTTPS Enforcement
    forceHttps: process.env.FORCE_HTTPS === 'true',
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,

    // CORS Configuration
    cors: {
      origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['https://yourdomain.com'],
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },

    // Security Headers
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    },

    // Content Security Policy
    csp: process.env.CSP_ENABLED === 'true' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.getjobber.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    } : null
  },

  // Performance Configuration
  performance: {
    // Compression
    compression: {
      enabled: process.env.ENABLE_COMPRESSION === 'true',
      level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
      threshold: 1024
    },

    // Caching
    cache: {
      staticMaxAge: parseInt(process.env.STATIC_FILE_CACHE_MAX_AGE) || 31536000,
      apiMaxAge: 300 // 5 minutes for API responses
    },

    // Rate Limiting
    rateLimit: {
      enabled: process.env.API_RATE_LIMIT_ENABLED === 'true',
      windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
      maxRequests: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 100
    }
  },

  // Database Configuration
  database: {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT) || 5432,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: process.env.DATABASE_SSL === 'true',
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE) || 10,
    acquireTimeoutMillis: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT) || 60000,
    createTimeoutMillis: parseInt(process.env.DATABASE_CREATE_TIMEOUT) || 30000,
    destroyTimeoutMillis: parseInt(process.env.DATABASE_DESTROY_TIMEOUT) || 5000,
    idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT) || 600000,
    reapIntervalMillis: parseInt(process.env.DATABASE_REAP_INTERVAL) || 1000
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    database: parseInt(process.env.REDIS_DB) || 1,
    tls: process.env.REDIS_TLS === 'true' ? {} : null
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    timestamp: true,
    colorize: false,
    filename: process.env.LOG_FILE || '/app/logs/app.log',
    maxsize: '10m',
    maxFiles: 5
  },

  // Health Check Configuration
  health: {
    enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    timeout: 5000,
    unhealthyThreshold: 3,
    healthyThreshold: 2
  },

  // Maintenance Mode
  maintenance: {
    enabled: process.env.MAINTENANCE_MODE === 'true',
    message: process.env.MAINTENANCE_MESSAGE || 'Service is temporarily unavailable',
    retryAfter: 3600
  },

  // Monitoring Configuration
  monitoring: {
    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: 'production',
      release: process.env.SOURCE_VERSION || '1.0.0'
    },

    metrics: {
      enabled: process.env.METRICS_ENABLED === 'true',
      port: parseInt(process.env.METRICS_PORT) || 9090,
      path: '/metrics'
    }
  },

  // Backup Configuration
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    path: process.env.BACKUP_PATH || '/app/backups'
  }
};

module.exports = productionConfig;