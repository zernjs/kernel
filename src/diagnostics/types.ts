export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerOptions {
  name?: string;
  level?: LogLevel;
  enabled?: boolean;
}

export interface Logger {
  level: LogLevel;
  isEnabled(level: LogLevel): boolean;
  trace(...args: unknown[]): void;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fatal(...args: unknown[]): void;
  child(opts: Partial<LoggerOptions>): Logger;
}

export interface Counter {
  inc(delta?: number): void;
  reset(): void;
  value(): number;
}

export interface Histogram {
  observe(ms: number): void;
  values(): readonly number[];
  reset(): void;
}

export interface MetricsRegistry {
  counter(name: string): Counter;
  histogram(name: string): Histogram;
}
