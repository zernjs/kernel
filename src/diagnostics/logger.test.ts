/**
 * @file Unit tests for logger factory and behavior.
 * @module diagnostics/logger.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from '@diagnostics/logger';
import type { LogLevel } from '@types';

afterEach(() => {
  vi.restoreAllMocks();
});

const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

describe('createLogger', () => {
  it('respects enabled=false (no output at any level)', () => {
    const spies = {
      trace: vi.spyOn(console, 'trace').mockImplementation((): void => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation((): void => {}),
      info: vi.spyOn(console, 'info').mockImplementation((): void => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation((): void => {}),
      error: vi.spyOn(console, 'error').mockImplementation((): void => {}),
    };
    const log = createLogger({ enabled: false });

    for (const lvl of levels) {
      switch (lvl) {
        case 'trace':
          log.trace('x');
          break;
        case 'debug':
          log.debug('x');
          break;
        case 'info':
          log.info('x');
          break;
        case 'warn':
          log.warn('x');
          break;
        case 'error':
          log.error('x');
          break;
        case 'fatal':
          log.fatal('x');
          break;
      }
    }

    expect(spies.trace).not.toHaveBeenCalled();
    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
  });

  it('filters by level threshold and prefixes with name', () => {
    const spies = {
      trace: vi.spyOn(console, 'trace').mockImplementation((): void => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation((): void => {}),
      info: vi.spyOn(console, 'info').mockImplementation((): void => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation((): void => {}),
      error: vi.spyOn(console, 'error').mockImplementation((): void => {}),
    };
    const log = createLogger({ name: 'svc', level: 'warn' });

    log.debug('a');
    log.info('b');
    log.warn('c');
    log.error('d');
    log.fatal('e');

    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).toHaveBeenCalledTimes(1);
    expect(spies.warn.mock.calls[0]?.[0]).toBe('[svc]');
    expect(spies.warn.mock.calls[0]?.[1]).toBe('c');

    // error and fatal both map to console.error
    expect(spies.error).toHaveBeenCalledTimes(2);
    expect(spies.error.mock.calls[0]?.[0]).toBe('[svc]');
    expect(spies.error.mock.calls[0]?.[1]).toBe('d');
    expect(spies.error.mock.calls[1]?.[0]).toBe('[svc]');
    expect(spies.error.mock.calls[1]?.[1]).toBe('e');
  });

  it('isEnabled reflects level threshold and enabled flag', () => {
    const log = createLogger({ level: 'info', enabled: true });
    expect(log.isEnabled('trace')).toBe(false);
    expect(log.isEnabled('debug')).toBe(false);
    expect(log.isEnabled('info')).toBe(true);
    expect(log.isEnabled('warn')).toBe(true);
    expect(log.isEnabled('error')).toBe(true);
    expect(log.isEnabled('fatal')).toBe(true);

    const off = createLogger({ enabled: false });
    expect(off.isEnabled('fatal')).toBe(false);
  });

  it('child inherits config and can override fields', () => {
    const parent = createLogger({ name: 'parent', level: 'info', enabled: true });
    const child = parent.child({ name: 'child', level: 'debug' });

    expect(child.level).toBe('debug');
    // isEnabled uses level threshold and enabled flag
    expect(child.isEnabled('debug')).toBe(true);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((): void => {});
    child.warn('msg');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toBe('[child]');
    expect(warnSpy.mock.calls[0]?.[1]).toBe('msg');
  });

  it('normalizes plain objects via JSON clone but preserves non-plain instances', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation((): void => {});
    const log = createLogger({ name: 'svc', level: 'info' });

    const plain: { a: number; nested: { b: number }; fn?: () => void } = {
      a: 1,
      nested: { b: 2 },
    };
    const date = new Date('2020-01-01T00:00:00.000Z');
    const error = new Error('boom');

    // Attach a function to verify it's removed by JSON stringify
    plain.fn = (): void => {};

    log.info(plain, date, error);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [prefix, p1, p2, p3] = infoSpy.mock.calls[0]!;
    expect(prefix).toBe('[svc]');

    // plain object cloned: functions removed
    expect(p1).toEqual({ a: 1, nested: { b: 2 } });

    // Date preserved (not stringified here, method chosen by logger)
    expect(p2 instanceof Date).toBe(true);

    // Error preserved as instance
    expect(p3).toBe(error);
  });

  it('routes to matching console method per level', () => {
    const spies = {
      trace: vi.spyOn(console, 'trace').mockImplementation((): void => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation((): void => {}),
      info: vi.spyOn(console, 'info').mockImplementation((): void => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation((): void => {}),
      error: vi.spyOn(console, 'error').mockImplementation((): void => {}),
    };
    const log = createLogger({ name: 'svc', level: 'trace' });

    for (const lvl of levels) {
      switch (lvl) {
        case 'trace':
          log.trace('x', 1, { y: 2 });
          break;
        case 'debug':
          log.debug('x', 1, { y: 2 });
          break;
        case 'info':
          log.info('x', 1, { y: 2 });
          break;
        case 'warn':
          log.warn('x', 1, { y: 2 });
          break;
        case 'error':
          log.error('x', 1, { y: 2 });
          break;
        case 'fatal':
          log.fatal('x', 1, { y: 2 });
          break;
      }
    }

    // trace, debug, info, warn, error called once each; fatal reuses error
    expect(spies.trace).toHaveBeenCalledTimes(1);
    expect(spies.debug).toHaveBeenCalledTimes(1);
    expect(spies.info).toHaveBeenCalledTimes(1);
    expect(spies.warn).toHaveBeenCalledTimes(1);
    expect(spies.error).toHaveBeenCalledTimes(2);
  });
});
