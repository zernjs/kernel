/**
 * @file Unit tests for the Node.js EventEmitter adapter.
 */
import { describe, it, expect, vi } from 'vitest';
import { createNodeEventEmitterAdapter } from '@events/adapters/node-event-emitter';
import type { NodeEventEmitterLike } from '@types';

describe('createNodeEventEmitterAdapter', () => {
  it('emits to target emitter with default name composer', () => {
    const calls: Array<[string, unknown]> = [];
    const emitter: NodeEventEmitterLike = {
      emit: vi.fn((eventName: string, payload: unknown) => {
        calls.push([eventName, payload]);
        return true;
      }),
      on: vi.fn((_e: string, _l: (...args: unknown[]) => void) => {}),
    };

    const adapter = createNodeEventEmitterAdapter({ emitter });
    expect(adapter.name).toBe('node-event-emitter');

    adapter.onEmit?.('ns', 'Login', { u: 1 });
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual(['ns:Login', { u: 1 }]);
  });

  it('uses custom composer when provided', () => {
    const emitter: NodeEventEmitterLike = {
      emit: vi.fn(() => true),
      on: vi.fn(() => {}),
    };
    const toEventName = (ns: string, ev: string): string => `${ns}---${ev}`;
    const adapter = createNodeEventEmitterAdapter({ emitter, toEventName });
    adapter.onEmit?.('a', 'b', 1);
    expect(emitter.emit).toHaveBeenCalledWith('a---b', 1);
  });

  it('exposes the emitter via getEmitter()', () => {
    const emitter: NodeEventEmitterLike = {
      emit: vi.fn(() => true),
      on: vi.fn(() => {}),
    };
    const adapter = createNodeEventEmitterAdapter({ emitter });
    expect(adapter.getEmitter()).toBe(emitter);
  });
});
