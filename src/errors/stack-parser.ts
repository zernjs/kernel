import type { StackFrame } from './types';

export function parseStackTrace(stack: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = stack.split('\n').slice(1);

  for (const line of lines) {
    const frame = parseStackFrame(line);
    if (frame) {
      frames.push(frame);
    }
  }

  return frames;
}

function parseStackFrame(line: string): StackFrame | null {
  const nodeRegex = /at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/;
  const anonymousRegex = /at\s+(.+?):(\d+):(\d+)/;

  const nodeMatch = line.match(nodeRegex);
  if (nodeMatch) {
    return {
      function: nodeMatch[1].trim(),
      file: nodeMatch[2],
      line: parseInt(nodeMatch[3], 10),
      column: parseInt(nodeMatch[4], 10),
    };
  }

  const anonymousMatch = line.match(anonymousRegex);
  if (anonymousMatch) {
    return {
      function: '<anonymous>',
      file: anonymousMatch[1],
      line: parseInt(anonymousMatch[2], 10),
      column: parseInt(anonymousMatch[3], 10),
    };
  }

  return null;
}

export function isInternalFrame(frame: StackFrame): boolean {
  const internalPatterns = [
    'node:internal',
    'node_modules',
    'zern-kernel/dist',
    'src/kernel',
    'src/plugin',
    'src/extension',
    'src/errors',
  ];

  return internalPatterns.some(pattern => frame.file.includes(pattern));
}
