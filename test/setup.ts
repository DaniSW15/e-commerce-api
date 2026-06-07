process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

// Database - usar las mismas credenciales que desarrollo
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USERNAME = 'ecommerce';  // tu usuario real
process.env.DB_PASSWORD = 'change_me_in_production';  // tu password real
process.env.DB_NAME = 'ecommerce_dev';  // tu DB real
process.env.DB_SYNCHRONIZE = 'true';
process.env.DB_LOGGING = 'true';

// Redis
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// JWT
process.env.JWT_ACCESS_SECRET = '0L+Qg2khAK+ubNktzfUIM6dxANWR1fRZc9GO1oO6jLw=';
process.env.JWT_ACCESS_EXPIRATION = '15m';
process.env.JWT_REFRESH_SECRET = 'aZfDyqWTJPYmr3ABrxw/mEL49Jy9rldsnP4IZH2zex4=';
process.env.JWT_REFRESH_EXPIRATION = '7d';

// Health Check - CRÍTICO: desactivar checks de memoria
process.env.HEALTH_MEMORY_HEAP_THRESHOLD = '0';
process.env.HEALTH_MEMORY_RSS_THRESHOLD = '0';

// ESTO DEBE SER LO PRIMERO que se ejecuta
process.env.HEALTH_MEMORY_HEAP_THRESHOLD = '0';
process.env.HEALTH_MEMORY_RSS_THRESHOLD = '0';
process.env.NODE_ENV = 'test';

// Desactivar rate limiting en tests si es configurable
process.env.LOGIN_MAX_ATTEMPTS = '999';
process.env.LOGIN_LOCKOUT_MINUTES = '0';