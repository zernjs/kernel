/**
 * @file Minimal structured logger with level filtering and child loggers.
 */
import type { LogLevel, Logger, LoggerOptions } from '@types';
import { isPlainObject } from '@utils';

const levelOrder: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * Create a logger instance.
 * @param options - Logger configuration (name, level, enabled).
 * @returns Logger implementation with level checks and child support.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const name = options.name ?? 'kernel';
  const level = options.level ?? 'info';
  const enabled = options.enabled ?? true;

  /**
   * Log at a given level if enabled and above threshold.
   * @param levelToLog - Target level to log.
   * @param args - Arbitrary log arguments.
   * @returns void
   */
  function logAt(levelToLog: LogLevel, args: unknown[]): void {
    if (!enabled) return;
    if (levelOrder[levelToLog] < levelOrder[level]) return;
    const prefix = `[${name}]`;
    const method: 'trace' | 'debug' | 'info' | 'warn' | 'error' =
      levelToLog === 'fatal'
        ? 'error'
        : (levelToLog as 'trace' | 'debug' | 'info' | 'warn' | 'error');
    const normalized = args.map(a => (isPlainObject(a) ? JSON.parse(JSON.stringify(a)) : a));
    (console[method] as (...a: unknown[]) => void)?.(prefix, ...normalized);
  }

  return {
    level,
    /**
     * Check if a given level would be logged.
     * @param lvl - Level to test.
     * @returns True when enabled and threshold allows it.
     */
    isEnabled(lvl: LogLevel): boolean {
      return enabled && levelOrder[lvl] >= levelOrder[level];
    },
    trace: (...a: unknown[]) => logAt('trace', a),
    debug: (...a: unknown[]) => logAt('debug', a),
    info: (...a: unknown[]) => logAt('info', a),
    warn: (...a: unknown[]) => logAt('warn', a),
    error: (...a: unknown[]) => logAt('error', a),
    fatal: (...a: unknown[]) => logAt('fatal', a),
    /**
     * Create a child logger inheriting current options.
     * @param childOpts - Overrides for the child instance.
     * @returns New logger instance.
     */
    child(childOpts: Partial<LoggerOptions>): Logger {
      return createLogger({ ...options, ...childOpts });
    },
  };
}
