import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypedEventEmitter } from './typed-event-emitter.js';
import {
  createUtilEventId,
  createEventSource,
  createUtilPluginId,
  createUtilPluginVersion,
  createKernelId,
  createKernelName,
  createKernelVersion,
  createNodeVersion,
} from '../types/index.js';
import type { Plugin, KernelInfo } from '../types/index.js';

describe('TypedEventEmitter', () => {
  let emitter: TypedEventEmitter;

  beforeEach(() => {
    emitter = new TypedEventEmitter();
  });

  // Helper functions to create proper mock objects
  const createMockPlugin = (): Plugin => ({
    id: createUtilPluginId('test-plugin'),
    version: createUtilPluginVersion('1.0.0'),
    metadata: {
      id: createUtilPluginId('test-plugin'),
      version: createUtilPluginVersion('1.0.0'),
      createdAt: Date.now(),
    },
    init: vi.fn(),
  });

  const createMockKernelInfo = (): KernelInfo => ({
    id: createKernelId('test-kernel'),
    name: createKernelName('test-kernel'),
    version: createKernelVersion('1.0.0'),
    state: 'ready',
    environment: 'development',
    startedAt: Date.now(),
    uptime: 1000,
    nodeVersion: createNodeVersion(process.version),
    platform: {
      arch: process.arch,
      platform: process.platform,
      release: '1.0.0',
    },
    memory: {
      used: 100,
      total: 1000,
      external: 50,
      heapUsed: 80,
      heapTotal: 200,
    },
    cpu: {
      user: 10,
      system: 5,
    },
    plugins: {
      total: 1,
      loaded: 1,
      ready: 1,
      error: 0,
      disabled: 0,
    },
    events: {
      emitted: 10,
      handled: 10,
      errors: 0,
    },
  });

  describe('Type Safety', () => {
    it('should enforce correct event types', () => {
      const handler = vi.fn();

      // This should work with correct types
      emitter.on('kernel:started', handler);
      emitter.emit('kernel:started', {
        type: 'kernel:started' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          info: createMockKernelInfo(),
          startedPlugins: ['test-plugin'],
          duration: 100,
        },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'kernel:started',
          data: expect.objectContaining({
            startedPlugins: ['test-plugin'],
            duration: 100,
          }),
        })
      );
    });

    it('should handle plugin events', () => {
      const handler = vi.fn();

      emitter.on('plugin:loaded', handler);
      emitter.emit('plugin:loaded', {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 50,
        },
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'plugin:loaded',
          data: expect.objectContaining({
            duration: 50,
          }),
        })
      );
    });
  });

  describe('Basic Event Operations', () => {
    it('should register and emit events', () => {
      const handler = vi.fn();
      const testEvent = {
        type: 'kernel:started' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          info: createMockKernelInfo(),
          startedPlugins: ['test-plugin'],
          duration: 100,
        },
      };

      emitter.on('kernel:started', handler);
      emitter.emit('kernel:started', testEvent);

      expect(handler).toHaveBeenCalledWith(testEvent);
    });

    it('should handle once listeners', () => {
      const handler = vi.fn();
      const testEvent1 = {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id-1'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 50,
        },
      };
      const testEvent2 = {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id-2'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 75,
        },
      };

      emitter.once('plugin:loaded', handler);
      emitter.emit('plugin:loaded', testEvent1);
      emitter.emit('plugin:loaded', testEvent2);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(testEvent1);
    });

    it('should remove listeners', () => {
      const handler = vi.fn();
      const testEvent = {
        type: 'kernel:error' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          error: new Error('Test error'),
          recoverable: false,
        },
      };

      emitter.on('kernel:error', handler);
      emitter.off('kernel:error', handler);
      emitter.emit('kernel:error', testEvent);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Async Event Handling', () => {
    it('should handle async emission', async () => {
      const handler1 = vi.fn().mockResolvedValue('result1');
      const handler2 = vi.fn().mockResolvedValue('result2');
      const testEvent = {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 100,
        },
      };

      emitter.on('plugin:loaded', handler1);
      emitter.on('plugin:loaded', handler2);

      const result = await emitter.emitAsync('plugin:loaded', testEvent);

      expect(result).toBe(true);
      expect(handler1).toHaveBeenCalledWith(testEvent);
      expect(handler2).toHaveBeenCalledWith(testEvent);
    });

    it('should handle async errors', async () => {
      const handler1 = vi.fn().mockResolvedValue('success');
      const handler2 = vi.fn().mockRejectedValue(new Error('Async error'));
      const handler3 = vi.fn().mockResolvedValue('also success');
      const testEvent = {
        type: 'kernel:error' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          error: new Error('Test error'),
          recoverable: true,
        },
      };

      emitter.on('kernel:error', handler1);
      emitter.on('kernel:error', handler2);
      emitter.on('kernel:error', handler3);

      const result = await emitter.emitAsync('kernel:error', testEvent);

      expect(result).toBe(false);
    });
  });

  describe('Pattern Matching', () => {
    it('should handle pattern-based listeners', () => {
      const kernelHandler = vi.fn();
      const allHandler = vi.fn();

      const kernelSubscription = emitter.onPattern('kernel:*', kernelHandler);
      const allSubscription = emitter.onPattern('*', allHandler);

      const kernelEvent = {
        type: 'kernel:started' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          info: createMockKernelInfo(),
          startedPlugins: ['test-plugin'],
          duration: 100,
        },
      };

      const pluginEvent = {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id-2'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 50,
        },
      };

      emitter.emit('kernel:started', kernelEvent);
      emitter.emit('plugin:loaded', pluginEvent);

      expect(kernelHandler).toHaveBeenCalledTimes(1);
      expect(allHandler).toHaveBeenCalledTimes(2);

      // Cleanup
      emitter.offPattern(kernelSubscription);
      emitter.offPattern(allSubscription);
    });

    it('should handle once pattern listeners', () => {
      const handler = vi.fn();

      const subscription = emitter.oncePattern('plugin:*', handler);

      const pluginEvent1 = {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id-1'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 50,
        },
      };

      const pluginEvent2 = {
        type: 'plugin:loading' as const,
        id: createUtilEventId('test-id-2'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          pluginId: 'test-plugin',
          path: '/test/path',
        },
      };

      emitter.emit('plugin:loaded', pluginEvent1);
      emitter.emit('plugin:loading', pluginEvent2);

      expect(handler).toHaveBeenCalledTimes(1);

      // Cleanup
      emitter.offPattern(subscription);
    });

    it('should remove pattern listeners', () => {
      const handler = vi.fn();

      const subscription = emitter.onPattern('kernel:*', handler);
      emitter.offPattern(subscription);

      const kernelEvent = {
        type: 'kernel:started' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          info: createMockKernelInfo(),
          startedPlugins: ['test-plugin'],
          duration: 100,
        },
      };

      emitter.emit('kernel:started', kernelEvent);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Event Waiting', () => {
    it('should wait for specific events', async () => {
      const testEvent = {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 100,
        },
      };

      const promise = emitter.waitFor('plugin:loaded');

      setTimeout(() => {
        emitter.emit('plugin:loaded', testEvent);
      }, 10);

      const result = await promise;
      expect(result).toEqual(testEvent);
    });

    it('should wait for multiple events', async () => {
      const kernelEvent = {
        type: 'kernel:started' as const,
        id: createUtilEventId('test-id-1'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          info: createMockKernelInfo(),
          startedPlugins: ['test-plugin'],
          duration: 100,
        },
      };

      const pluginEvent = {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id-2'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 50,
        },
      };

      const promise = emitter.waitForAll(['kernel:started', 'plugin:loaded']);

      setTimeout(() => {
        emitter.emit('kernel:started', kernelEvent);
        emitter.emit('plugin:loaded', pluginEvent);
      }, 10);

      const results = await promise;
      expect(results).toEqual({
        'kernel:started': kernelEvent,
        'plugin:loaded': pluginEvent,
      });
    });

    it('should timeout when waiting for events', async () => {
      const promise = emitter.waitFor('kernel:started', 100);

      await expect(promise).rejects.toThrow('Timeout waiting for event kernel:started after 100ms');
    });
  });

  describe('Utility Methods', () => {
    it('should return listener count', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      expect(emitter.listenerCount('kernel:started')).toBe(0);

      emitter.on('kernel:started', handler1);
      expect(emitter.listenerCount('kernel:started')).toBe(1);

      emitter.on('kernel:started', handler2);
      expect(emitter.listenerCount('kernel:started')).toBe(2);
    });

    it('should return listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('plugin:loaded', handler1);
      emitter.on('plugin:loaded', handler2);

      const listeners = emitter.listeners('plugin:loaded');
      expect(listeners).toEqual([handler1, handler2]);
    });

    it('should return event names', () => {
      emitter.on('kernel:started', vi.fn());
      emitter.on('plugin:loaded', vi.fn());
      emitter.on('kernel:error', vi.fn());

      const eventNames = emitter.eventNames();
      expect(eventNames).toEqual(['kernel:started', 'plugin:loaded', 'kernel:error']);
    });

    it('should remove all listeners', () => {
      emitter.on('kernel:started', vi.fn());
      emitter.on('plugin:loaded', vi.fn());

      expect(emitter.listenerCount('kernel:started')).toBe(1);
      expect(emitter.listenerCount('plugin:loaded')).toBe(1);

      emitter.removeAllListeners();

      expect(emitter.listenerCount('kernel:started')).toBe(0);
      expect(emitter.listenerCount('plugin:loaded')).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in listeners', () => {
      const errorHandler = vi.fn();
      const normalHandler = vi.fn();
      const faultyHandler = vi.fn(() => {
        throw new Error('Test error');
      });

      const testEvent = {
        type: 'plugin:loaded' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          plugin: createMockPlugin(),
          duration: 100,
        },
      };

      emitter.onError(errorHandler);
      emitter.on('plugin:loaded', faultyHandler);
      emitter.on('plugin:loaded', normalHandler);

      emitter.emit('plugin:loaded', testEvent);

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error), 'plugin:loaded', testEvent);
      expect(normalHandler).toHaveBeenCalledWith(testEvent);
    });

    it('should remove error handlers', () => {
      const errorHandler = vi.fn();

      emitter.onError(errorHandler);
      emitter.offError(errorHandler);

      const testEvent = {
        type: 'kernel:error' as const,
        id: createUtilEventId('test-id'),
        timestamp: Date.now(),
        source: createEventSource('test'),
        data: {
          error: new Error('Test error'),
          recoverable: false,
        },
      };

      emitter.on('kernel:error', () => {
        throw new Error('Test error');
      });

      emitter.emit('kernel:error', testEvent);

      expect(errorHandler).not.toHaveBeenCalled();
    });
  });

  describe('EventBus Integration', () => {
    it('should provide access to underlying EventBus', () => {
      const eventBus = emitter.getEventBus();
      expect(eventBus).toBeDefined();
      expect(typeof eventBus.on).toBe('function');
      expect(typeof eventBus.emit).toBe('function');
    });
  });
});
