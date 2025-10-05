/**
 * @file Database plugin
 * @description Database connection and operations
 */

import { plugin } from '../../../../src';
import { config } from '../config';
import { loggerPlugin } from './logger';

export const databasePlugin = plugin('database', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .metadata({
    author: 'Minimal App',
    description: 'Database connection manager',
    connectionString: config.database.url,
  })
  .onInit(({ plugins }) => {
    plugins.logger.info('Initializing database connection...');
  })
  .onReady(({ plugins }) => {
    plugins.logger.info('Database ready!');
  })
  .onShutdown(({ plugins }) => {
    plugins.logger.info('Closing database connections...');
  })
  .setup(({ plugins }) => {
    let connected = false;

    const query = async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
      if (!connected) {
        throw new Error('Database not connected');
      }
      plugins.logger.debug(`Executing query: ${sql}`, params);
      // Simulate query execution
      return [] as T[];
    };

    return {
      async connect(): Promise<{ connected: boolean }> {
        plugins.logger.info(`Connecting to: ${config.database.url}`);
        // Simulate connection
        connected = true;
        return { connected };
      },

      async disconnect(): Promise<void> {
        plugins.logger.info('Disconnecting from database...');
        connected = false;
      },

      isConnected(): boolean {
        return connected;
      },

      query,

      users: {
        async findById(id: string): Promise<{ id: string; name: string; email: string } | null> {
          const results = await query<{ id: string; name: string; email: string }>(
            'SELECT * FROM users WHERE id = $1',
            [id]
          );
          return results[0] || null;
        },

        async create(data: {
          name: string;
          email: string;
        }): Promise<{ id: string; name: string; email: string }> {
          const id = Math.random().toString(36).slice(2);
          plugins.logger.info(`Creating user: ${data.name}`);
          return { id, ...data };
        },
      },
    };
  });
