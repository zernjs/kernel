import { ErrorSeverity, type ErrorConfig } from './types';
import type { ZernError } from './base';
import { parseStackTrace, isInternalFrame } from './stack-parser';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
} as const;

function colorize(text: string, color: keyof typeof colors, enabled: boolean): string {
  return enabled ? `${colors[color]}${text}${colors.reset}` : text;
}

function getSeverityIcon(severity: ErrorSeverity): string {
  const icons = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    fatal: '💀',
  };
  return icons[severity];
}

function getSeverityColor(severity: ErrorSeverity): keyof typeof colors {
  const colorMap = {
    info: 'blue' as const,
    warn: 'yellow' as const,
    error: 'red' as const,
    fatal: 'red' as const,
  };
  return colorMap[severity];
}

export function formatError(error: ZernError, config: ErrorConfig): string {
  const lines: string[] = [];
  const c = config.enableColors ?? true;

  const icon = getSeverityIcon(error.severity);
  const severityText = colorize(
    `${icon} ${error.severity.toUpperCase()}`,
    getSeverityColor(error.severity),
    c
  );

  lines.push('');
  lines.push(colorize('━'.repeat(80), 'gray', c));
  lines.push(`${severityText} ${colorize(error.code, 'bold', c)}`);
  lines.push('');

  lines.push(colorize(error.message, getSeverityColor(error.severity), c));
  lines.push('');

  if (config.showContext && Object.keys(error.context).length > 0) {
    lines.push(colorize('Context:', 'bold', c));
    for (const [key, value] of Object.entries(error.context)) {
      if (value !== undefined) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        lines.push(`  ${colorize(key, 'gray', c)}: ${displayValue}`);
      }
    }
    lines.push('');
  }

  if (config.captureStackTrace && error.stack) {
    const frames = parseStackTrace(error.stack);
    const filtered = config.filterInternalFrames ? frames.filter(f => !isInternalFrame(f)) : frames;

    if (filtered.length > 0) {
      lines.push(colorize('Stack Trace:', 'bold', c));
      const limit = config.stackTraceLimit ?? 10;
      filtered.slice(0, limit).forEach((frame, i) => {
        const arrow = i === 0 ? '→' : ' ';
        lines.push(`  ${arrow} ${colorize(frame.function, 'blue', c)}`);
        lines.push(`    ${colorize(frame.file, 'gray', c)}:${frame.line}:${frame.column}`);
      });
      lines.push('');
    }
  }

  if (config.showSolutions && error.solutions.length > 0) {
    lines.push(colorize('💡 Possible Solutions:', 'green', c));
    error.solutions.forEach((solution, i) => {
      lines.push(`  ${i + 1}. ${colorize(solution.title, 'bold', c)}`);
      lines.push(`     ${solution.description}`);
      if (solution.code) {
        lines.push('');
        lines.push(colorize(`     ${solution.code}`, 'gray', c));
      }
      if (i < error.solutions.length - 1) {
        lines.push('');
      }
    });
    lines.push('');
  }

  if (config.showTimestamp) {
    lines.push(colorize(`Timestamp: ${error.timestamp.toISOString()}`, 'gray', c));
    lines.push('');
  }

  lines.push(colorize('━'.repeat(80), 'gray', c));
  lines.push('');

  return lines.join('\n');
}
