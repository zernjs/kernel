/**
 * @file Logger plugin
 * @description Simple logging functionality
 */

import { plugin } from '../../../../src';
import { config } from '../config';

export const loggerPlugin = plugin('logger', '1.0.0')
  .metadata({
    author: 'Minimal App',
    description: 'Simple logger plugin',
  })
  .setup(() => {
    const logLevel = config.logger.level;

    const shouldLog = (level: string): boolean => {
      const levels = ['debug', 'info', 'warn', 'error'];
      return levels.indexOf(level) >= levels.indexOf(logLevel);
    };

    return {
      debug: (...args: unknown[]): void => {
        if (shouldLog('debug')) {
          console.log('[DEBUG]', ...args);
        }
      },
      info: (...args: unknown[]): void => {
        if (shouldLog('info')) {
          console.log('[INFO]', ...args);
        }
      },
      warn: (...args: unknown[]): void => {
        if (shouldLog('warn')) {
          console.warn('[WARN]', ...args);
        }
      },
      error: (...args: unknown[]): void => {
        if (shouldLog('error')) {
          console.error('[ERROR]', ...args);
        }
      },
    };
  });
