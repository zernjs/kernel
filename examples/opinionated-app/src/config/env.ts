/**
 * @file Environment validation
 * @description Validates and parses environment variables
 */

export interface Environment {
  NODE_ENV: 'development' | 'production' | 'test';
  APP_NAME: string;
  APP_VERSION: string;
  DATABASE_URL: string;
  DB_MAX_CONNECTIONS: number;
  DB_TIMEOUT: number;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  ENABLE_MONITORING: boolean;
  MONITORING_INTERVAL: number;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const env: Environment = {
  NODE_ENV: (process.env.NODE_ENV as Environment['NODE_ENV']) || 'development',
  APP_NAME: getEnv('APP_NAME', 'Opinionated App'),
  APP_VERSION: getEnv('APP_VERSION', '1.0.0'),
  DATABASE_URL: getEnv('DATABASE_URL', 'postgresql://localhost:5432/mydb'),
  DB_MAX_CONNECTIONS: getEnvNumber('DB_MAX_CONNECTIONS', 10),
  DB_TIMEOUT: getEnvNumber('DB_TIMEOUT', 5000),
  LOG_LEVEL: (process.env.LOG_LEVEL as Environment['LOG_LEVEL']) || 'info',
  ENABLE_MONITORING: getEnvBoolean('ENABLE_MONITORING', true),
  MONITORING_INTERVAL: getEnvNumber('MONITORING_INTERVAL', 10000),
};
