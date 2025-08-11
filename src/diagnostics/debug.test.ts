/**
 * @file Unit tests for `dumpObject` debug utility.
 * @module diagnostics/debug.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { dumpObject } from '@diagnostics/debug';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('dumpObject', () => {
  it('logs with console.debug including label and value', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const value = { a: 1 };
    dumpObject('test', value);

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0]?.[0]).toBe('[debug] test:');
    expect(debugSpy.mock.calls[0]?.[1]).toEqual(value);
  });
});
