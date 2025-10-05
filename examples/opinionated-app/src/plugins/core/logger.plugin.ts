/**
 * @file Logger plugin
 * @description Centralized logging functionality
 */

import { plugin } from '../../../../../src';
import { env } from '../../config';

export const loggerPlugin = plugin('logger', '1.0.0')
  .metadata({
    author: 'Opinionated App',
    description: 'Structured logger with levels',
    logLevel: env.LOG_LEVEL,
  })
  .setup(() => {
    const shouldLog = (level: string): boolean => {
      const levels = ['debug', 'info', 'warn', 'error'];
      return levels.indexOf(level) >= levels.indexOf(env.LOG_LEVEL);
    };

    const formatMessage = (level: string, ...args: unknown[]): string => {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      return `${prefix} ${args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ')}`;
    };

    return {
      debug(...args: unknown[]): void {
        if (shouldLog('debug')) {
          console.log(formatMessage('debug', ...args));
        }
      },

      info(...args: unknown[]): void {
        if (shouldLog('info')) {
          console.log(formatMessage('info', ...args));
        }
      },

      warn(...args: unknown[]): void {
        if (shouldLog('warn')) {
          console.warn(formatMessage('warn', ...args));
        }
      },

      error(...args: unknown[]): void {
        if (shouldLog('error')) {
          console.error(formatMessage('error', ...args));
        }
      },
    };
  });
