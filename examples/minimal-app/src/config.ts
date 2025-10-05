/**
 * @file Application configuration
 * @description Centralized configuration management
 */

export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'test';
  };
  database: {
    url: string;
    maxConnections: number;
  };
  logger: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

export const config: AppConfig = {
  app: {
    name: 'Minimal App',
    version: '1.0.0',
    environment: (process.env.NODE_ENV as AppConfig['app']['environment']) || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/mydb',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  },
  logger: {
    level: (process.env.LOG_LEVEL as AppConfig['logger']['level']) || 'info',
  },
};
