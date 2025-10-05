/**
 * @file Database configuration
 * @description Database connection settings
 */

import { env } from './env';

export interface DatabaseConfiguration {
  url: string;
  maxConnections: number;
  timeout: number;
}

export const databaseConfig: DatabaseConfiguration = {
  url: env.DATABASE_URL,
  maxConnections: env.DB_MAX_CONNECTIONS,
  timeout: env.DB_TIMEOUT,
};
