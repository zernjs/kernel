/**
 * @file Unit tests for the RxJS adapter.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRxjsAdapter } from '@events/adapters/rxjs';
import type { RxjsSubjectLike } from '@types';

describe('createRxjsAdapter', () => {
  it('creates subjects on define and nexts payloads on emit', () => {
    const subjects = new Map<string, RxjsSubjectLike<unknown>>();
    const factory = vi.fn((ns: string, ev: string): RxjsSubjectLike<unknown> => {
      const key = `${ns}:${ev}`;
      const s: RxjsSubjectLike<unknown> = { next: vi.fn((_v: unknown): void => {}) };
      subjects.set(key, s);
      return s;
    });

    const adapter = createRxjsAdapter({ subjectFactory: factory });
    expect(adapter.name).toBe('rxjs');

    adapter.onDefine?.('auth', 'login');
    adapter.onDefine?.('auth', 'logout');
    expect(factory).toHaveBeenCalledTimes(2);

    adapter.onEmit?.('auth', 'login', { id: 'u1' });
    const subject = subjects.get('auth:login')!;
    expect(
      (subject.next as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0]
    ).toEqual({ id: 'u1' });
  });

  it('ignores emit when subject was not defined', () => {
    const factory = vi.fn(
      (_ns: string, _ev: string): RxjsSubjectLike<unknown> => ({
        next: vi.fn(() => {}),
      })
    );
    const adapter = createRxjsAdapter({ subjectFactory: factory });
    // emit for an undefined event; should not create or next
    adapter.onEmit?.('x', 'y', 1);
    expect(factory).not.toHaveBeenCalled();
  });
});
