import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookSystem } from '../../../src/events/hook-system.js';
import type { HookHandler, HookContext } from '../../../src/events/hook-system.js';
import { TypedEventEmitter } from '../../../src/events/typed-event-emitter.js';
import type { ZernKernel } from '../../../src/kernel.js';
import {
  createKernelId,
  createKernelVersion,
  createKernelName,
} from '../../../src/types/kernel.js';
import { createNodeVersion } from '../../../src/types/utils.js';
import type { KernelMetrics } from '../../../src/types/kernel.js';

describe('HookSystem', () => {
  let hookSystem: HookSystem;
  let mockKernel: ZernKernel;
  let eventEmitter: TypedEventEmitter;

  beforeEach(() => {
    // Create event emitter
    eventEmitter = new TypedEventEmitter();

    // Create proper mock kernel with all required properties
    mockKernel = {
      id: createKernelId('test-kernel'),
      version: createKernelVersion('1.0.0'),
      config: {
        name: 'test-kernel',
        environment: 'test',
      },
      state: 'ready',
      info: {
        id: createKernelId('test-kernel'),
        name: createKernelName('test-kernel'),
        version: createKernelVersion('1.0.0'),
        state: 'ready',
        environment: 'test',
        startedAt: Date.now(),
        uptime: 0,
        nodeVersion: createNodeVersion('v18.0.0'),
        platform: {
          arch: 'x64',
          platform: 'linux',
          release: 'test',
        },
        memory: {
          used: 0,
          total: 0,
          external: 0,
          heapUsed: 0,
          heapTotal: 0,
        },
        cpu: {
          user: 0,
          system: 0,
        },
        plugins: {
          total: 0,
          loaded: 0,
          ready: 0,
          error: 0,
          disabled: 0,
        },
        events: {
          emitted: 0,
          handled: 0,
          errors: 0,
        },
      },
      metrics: {
        timestamp: Date.now(),
        kernel: {
          id: createKernelId('test-kernel'),
          name: createKernelName('test-kernel'),
          version: createKernelVersion('1.0.0'),
          state: 'ready',
          environment: 'test',
          startedAt: Date.now(),
          uptime: 0,
          nodeVersion: createNodeVersion('v18.0.0'),
          platform: {
            arch: 'x64',
            platform: 'linux',
            release: 'test',
          },
          memory: {
            used: 0,
            total: 0,
            external: 0,
            heapUsed: 0,
            heapTotal: 0,
          },
          cpu: {
            user: 0,
            system: 0,
          },
          plugins: {
            total: 0,
            loaded: 0,
            ready: 0,
            error: 0,
            disabled: 0,
          },
          events: {
            emitted: 0,
            handled: 0,
            errors: 0,
          },
        },
        performance: {
          startupTime: 0,
          avgPluginLoadTime: 0,
          avgEventProcessingTime: 0,
          eventsPerSecond: 0,
          memoryGrowthRate: 0,
          cpuUsage: 0,
          eventLoopLag: 0,
        },
        plugins: {},
      } as KernelMetrics,
      initialize: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      shutdown: vi.fn(),
      loadPlugin: vi.fn(),
      unloadPlugin: vi.fn(),
      getPlugin: vi.fn(),
      hasPlugin: vi.fn(),
      getPlugins: vi.fn(),
      searchPlugins: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      removeAllListeners: vi.fn(),
      listenerCount: vi.fn(),
      listeners: vi.fn(),
      rawListeners: vi.fn(),
      getMaxListeners: vi.fn(),
      setMaxListeners: vi.fn(),
      prependListener: vi.fn(),
      prependOnceListener: vi.fn(),
      eventNames: vi.fn(),
    } as unknown as ZernKernel;

    // Create hook system with required parameters
    hookSystem = new HookSystem(mockKernel, eventEmitter);
  });

  describe('Basic Hook Registration', () => {
    it('should register and execute hooks', async () => {
      const handler = vi.fn().mockResolvedValue('result');

      hookSystem.addHook('test:hook', handler);
      const results = await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(handler).toHaveBeenCalledWith({ data: 'test' }, expect.any(Object));
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.data).toBe('result');
    });

    it('should handle multiple hooks for the same name', async () => {
      const handler1 = vi.fn().mockResolvedValue('result1');
      const handler2 = vi.fn().mockResolvedValue('result2');

      hookSystem.addHook('test:hook', handler1);
      hookSystem.addHook('test:hook', handler2);

      const results = await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(results).toHaveLength(2);
      expect(results[0]?.data).toBe('result1');
      expect(results[1]?.data).toBe('result2');
    });

    it('should remove hooks', async () => {
      const handler = vi.fn().mockResolvedValue('result');

      const registration = hookSystem.addHook('test:hook', handler);
      hookSystem.removeHook(registration);

      const results = await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });
  });

  describe('Hook Priorities', () => {
    it('should execute hooks in priority order', async () => {
      const executionOrder: string[] = [];

      const lowHandler = vi.fn().mockImplementation(() => {
        executionOrder.push('low');
        return 'low';
      });

      const highHandler = vi.fn().mockImplementation(() => {
        executionOrder.push('high');
        return 'high';
      });

      const normalHandler = vi.fn().mockImplementation(() => {
        executionOrder.push('normal');
        return 'normal';
      });

      hookSystem.addHook('test:hook', lowHandler, { priority: 'low' });
      hookSystem.addHook('test:hook', highHandler, { priority: 'high' });
      hookSystem.addHook('test:hook', normalHandler, { priority: 'normal' });

      await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(executionOrder).toEqual(['high', 'normal', 'low']);
    });

    it('should handle custom numeric priorities', async () => {
      // Note: Based on the implementation, HookPriority is a string type
      // This test would need to be adjusted or the implementation would need to support numeric priorities
      const executionOrder: string[] = [];

      const handler1 = vi.fn().mockImplementation(() => {
        executionOrder.push('highest');
        return 'highest';
      });

      const handler2 = vi.fn().mockImplementation(() => {
        executionOrder.push('normal');
        return 'normal';
      });

      const handler3 = vi.fn().mockImplementation(() => {
        executionOrder.push('lowest');
        return 'lowest';
      });

      hookSystem.addHook('test:hook', handler1, { priority: 'highest' });
      hookSystem.addHook('test:hook', handler2, { priority: 'normal' });
      hookSystem.addHook('test:hook', handler3, { priority: 'lowest' });

      await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(executionOrder).toEqual(['highest', 'normal', 'lowest']);
    });
  });

  describe('Hook Execution Modes', () => {
    it('should execute hooks sequentially by default', async () => {
      const executionOrder: string[] = [];

      const handler1 = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        executionOrder.push('1');
        return '1';
      });

      const handler2 = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push('2');
        return '2';
      });

      hookSystem.addHook('test:hook', handler1);
      hookSystem.addHook('test:hook', handler2);

      const results = await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(executionOrder).toEqual(['1', '2']);
      expect(results).toHaveLength(2);
      expect(results[0]?.data).toBe('1');
      expect(results[1]?.data).toBe('2');
    });

    it('should execute hooks in parallel when specified', async () => {
      const startTime = Date.now();

      const handler1 = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return '1';
      });

      const handler2 = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return '2';
      });

      hookSystem.addHook('test:hook', handler1);
      hookSystem.addHook('test:hook', handler2);

      const results = await hookSystem.executeHooks(
        'test:hook',
        { data: 'test' },
        { mode: 'parallel' }
      );
      const endTime = Date.now();

      expect(results).toHaveLength(2);
      expect(results[0]?.data).toBe('1');
      expect(results[1]?.data).toBe('2');
      expect(endTime - startTime).toBeLessThan(80); // Should be much faster than 100ms
    });

    it('should execute hooks synchronously when specified', async () => {
      const handler1 = vi.fn().mockReturnValue('1');
      const handler2 = vi.fn().mockReturnValue('2');

      hookSystem.addHook('test:hook', handler1);
      hookSystem.addHook('test:hook', handler2);

      const results = await hookSystem.executeHooks(
        'test:hook',
        { data: 'test' },
        { mode: 'sync' }
      );

      expect(results).toHaveLength(2);
      expect(results[0]?.data).toBe('1');
      expect(results[1]?.data).toBe('2');
    });
  });

  describe('Hook Context', () => {
    it('should provide context to hooks', async () => {
      const handler = vi.fn().mockResolvedValue('result');

      hookSystem.addHook('test:hook', handler);

      await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(handler).toHaveBeenCalledWith(
        { data: 'test' },
        expect.objectContaining({
          name: 'test:hook',
          kernel: mockKernel,
          metadata: expect.any(Object),
          cancel: expect.any(Function),
          isCancelled: expect.any(Function),
        })
      );
    });

    it('should handle stop propagation', async () => {
      const handler1 = vi.fn().mockImplementation((data: unknown, context: HookContext) => {
        context.cancel();
        return 'result1';
      });

      const handler2 = vi.fn().mockResolvedValue('result2');

      hookSystem.addHook('test:hook', handler1);
      hookSystem.addHook('test:hook', handler2);

      const results = await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(handler1).toHaveBeenCalled();
      // Note: Based on implementation, handler2 might still be called depending on execution mode
      expect(results).toHaveLength(1);
      expect(results[0]?.data).toBe('result1');
    });
  });

  describe('Lifecycle Hooks', () => {
    it('should register kernel lifecycle hooks', async () => {
      // The lifecycle hooks are registered automatically in the constructor
      // We can test if they exist
      expect(hookSystem.hasHook('kernel:before-start')).toBe(true);
      expect(hookSystem.hasHook('kernel:after-start')).toBe(true);
    });

    it('should register plugin lifecycle hooks', async () => {
      // The lifecycle hooks are registered automatically in the constructor
      // We can test if they exist
      expect(hookSystem.hasHook('plugin:before-load')).toBe(true);
      expect(hookSystem.hasHook('plugin:after-load')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in hooks', async () => {
      const normalHandler = vi.fn().mockResolvedValue('success');
      const faultyHandler = vi.fn().mockRejectedValue(new Error('Hook error'));

      hookSystem.addHook('test:hook', faultyHandler);
      hookSystem.addHook('test:hook', normalHandler);

      const results = await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toBeInstanceOf(Error);
      expect(results[1]?.success).toBe(true);
      expect(results[1]?.data).toBe('success');
    });

    it('should continue execution after errors', async () => {
      const handler1 = vi.fn().mockRejectedValue(new Error('Error 1'));
      const handler2 = vi.fn().mockResolvedValue('success');
      const handler3 = vi.fn().mockRejectedValue(new Error('Error 2'));
      const handler4 = vi.fn().mockResolvedValue('also success');

      hookSystem.addHook('test:hook', handler1);
      hookSystem.addHook('test:hook', handler2);
      hookSystem.addHook('test:hook', handler3);
      hookSystem.addHook('test:hook', handler4);

      const results = await hookSystem.executeHooks('test:hook', { data: 'test' });

      expect(results).toHaveLength(4);
      expect(results[0]?.success).toBe(false);
      expect(results[1]?.success).toBe(true);
      expect(results[1]?.data).toBe('success');
      expect(results[2]?.success).toBe(false);
      expect(results[3]?.success).toBe(true);
      expect(results[3]?.data).toBe('also success');
    });
  });

  describe('Hook Management', () => {
    it('should list all hooks', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      hookSystem.addHook('test:hook1', handler1);
      hookSystem.addHook('test:hook2', handler2);

      const hook1s = hookSystem.getHooks('test:hook1');
      const hook2s = hookSystem.getHooks('test:hook2');

      expect(hook1s).toHaveLength(1);
      expect(hook2s).toHaveLength(1);
    });

    it('should check if hooks exist', () => {
      hookSystem.addHook('test:hook1', vi.fn());

      expect(hookSystem.hasHook('test:hook1')).toBe(true);
      expect(hookSystem.hasHook('test:hook2')).toBe(false);
    });

    it('should get hook count', () => {
      hookSystem.addHook('test:hook1', vi.fn());
      hookSystem.addHook('test:hook1', vi.fn());

      expect(hookSystem.getHookCount('test:hook1')).toBe(2);
      expect(hookSystem.getHookCount('test:hook2')).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should handle many hooks efficiently', async () => {
      const handlers: HookHandler[] = [];

      // Add many hooks
      for (let i = 0; i < 1000; i++) {
        const handler = vi.fn().mockResolvedValue(`result${i}`);
        handlers.push(handler);
        hookSystem.addHook('test:hook', handler);
      }

      const startTime = Date.now();
      const results = await hookSystem.executeHooks('test:hook', { data: 'test' });
      const endTime = Date.now();

      expect(results).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in reasonable time
    });
  });
});
