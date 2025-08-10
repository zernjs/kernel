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

export function createLogger(options: LoggerOptions = {}): Logger {
  const name = options.name ?? 'kernel';
  const level = options.level ?? 'info';
  const enabled = options.enabled ?? true;

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
    isEnabled(lvl: LogLevel): boolean {
      return enabled && levelOrder[lvl] >= levelOrder[level];
    },
    trace: (...a: unknown[]) => logAt('trace', a),
    debug: (...a: unknown[]) => logAt('debug', a),
    info: (...a: unknown[]) => logAt('info', a),
    warn: (...a: unknown[]) => logAt('warn', a),
    error: (...a: unknown[]) => logAt('error', a),
    fatal: (...a: unknown[]) => logAt('fatal', a),
    child(childOpts: Partial<LoggerOptions>): Logger {
      return createLogger({ ...options, ...childOpts });
    },
  };
}
