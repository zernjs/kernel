export enum ErrorSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface ErrorContext {
  plugin?: string;
  method?: string;
  phase?: 'init' | 'setup' | 'ready' | 'shutdown' | 'runtime';
  file?: string;
  line?: number;
  column?: number;
  timestamp?: Date;
  [key: string]: unknown;
}

export interface ErrorSolution {
  title: string;
  description: string;
  code?: string;
}

export interface ErrorConfig {
  captureStackTrace?: boolean;
  stackTraceLimit?: number;
  filterInternalFrames?: boolean;
  enableColors?: boolean;
  showContext?: boolean;
  showSolutions?: boolean;
  showTimestamp?: boolean;
  severity?: ErrorSeverity;
}

export interface StackFrame {
  function: string;
  file: string;
  line: number;
  column: number;
}
