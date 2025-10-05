/**
 * @file Database plugin
 * @description Database connection and query interface
 */

import { plugin } from '../../../../../src';
import { databaseConfig } from '../../config';
import { loggerPlugin } from './logger.plugin';

export const databasePlugin = plugin('database', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .metadata({
    author: 'Opinionated App',
    description: 'Database connection manager',
    connectionString: databaseConfig.url,
    maxConnections: databaseConfig.maxConnections,
  })
  .onInit(({ plugins }) => {
    plugins.logger.info('Initializing database connection pool...');
  })
  .onReady(({ plugins }) => {
    plugins.logger.info(`Database ready! Max connections: ${databaseConfig.maxConnections}`);
  })
  .onShutdown(({ plugins }) => {
    plugins.logger.info('Closing database connections...');
  })
  .setup(({ plugins }) => {
    let connected = false;
    let connectionPool: unknown[] = [];

    return {
      async connect(): Promise<{ connected: boolean; poolSize: number }> {
        plugins.logger.info(`Connecting to: ${databaseConfig.url}`);

        // Simulate connection pool creation
        connectionPool = Array.from({ length: databaseConfig.maxConnections }, (_, i) => ({
          id: i,
          available: true,
        }));

        connected = true;
        plugins.logger.info('Database connected successfully!');

        return {
          connected,
          poolSize: connectionPool.length,
        };
      },

      async disconnect(): Promise<void> {
        plugins.logger.info('Disconnecting from database...');
        connectionPool = [];
        connected = false;
        plugins.logger.info('Database disconnected.');
      },

      isConnected(): boolean {
        return connected;
      },

      getPoolSize(): number {
        return connectionPool.length;
      },

      async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
        if (!connected) {
          throw new Error('Database not connected');
        }

        plugins.logger.debug(`Executing query: ${sql}`, params);

        // Simulate query execution
        await new Promise(resolve => setTimeout(resolve, 10));

        return [] as T[];
      },

      async transaction<T>(callback: () => Promise<T>): Promise<T> {
        plugins.logger.debug('Starting transaction...');

        try {
          const result = await callback();
          plugins.logger.debug('Transaction committed.');
          return result;
        } catch (error) {
          plugins.logger.error('Transaction rolled back:', error);
          throw error;
        }
      },
    };
  });
