import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, TypedEventEmitter, HookSystem } from '../../src/events/index.js';
import type { KernelInfo, KernelMetrics } from '../../src/types/index.js';
import { ZernKernel } from '../../src/kernel.js';
import { createKernelId, createKernelVersion, createKernelName } from '../../src/types/kernel.js';
import {
  createNodeVersion,
  createEventId,
  createPluginVersion,
  createPluginId,
} from '../../src/types/utils.js';
import { createEventSource, type BaseEvent } from '../../src/types/events.js';
import type { Plugin, PluginLifecycleContext } from '../../src/types/plugin.js';

describe('Events Integration Tests', () => {
  let eventBus: EventBus;
  let typedEmitter: TypedEventEmitter;
  let hookSystem: HookSystem;
  let mockKernel: ZernKernel;

  beforeEach(() => {
    eventBus = new EventBus();
    typedEmitter = new TypedEventEmitter();

    // Clean up any existing listeners
    eventBus.removeAllListeners();
    typedEmitter.removeAllListeners();

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
      } as KernelInfo,
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

    hookSystem = new HookSystem(mockKernel, typedEmitter);

    // Remove automatic lifecycle hooks to avoid interference in tests
    const lifecycleHooks = hookSystem
      .getHooks()
      .filter(
        hook =>
          hook.name === 'plugin:before-load' ||
          hook.name === 'plugin:after-load' ||
          hook.name === 'kernel:before-start' ||
          hook.name === 'kernel:after-start'
      );
    lifecycleHooks.forEach(hook => hookSystem.removeHook(hook.id));
  });

  // Helper function to create mock plugin
  const createMockPlugin = (id: string, overrides: Partial<Plugin> = {}): Plugin => ({
    id: createPluginId(id),
    version: createPluginVersion('1.0.0'),
    metadata: {
      id: createPluginId(id),
      version: createPluginVersion('1.0.0'),
      name: `Test Plugin ${id}`,
      description: `Test plugin for ${id}`,
      author: 'Test Author',
      license: 'MIT',
      homepage: 'https://example.com',
      repository: 'https://github.com/example/plugin',
      keywords: ['test'],
      ...overrides.metadata,
    },
    init: async (_context: PluginLifecycleContext): Promise<void> => {
      // Mock initialization
    },
    destroy: async (): Promise<void> => {
      // Mock cleanup
    },
    ...overrides,
  });

  describe('EventBus and TypedEventEmitter Integration', () => {
    it('should work together for plugin lifecycle events', async () => {
      const loadedPlugins: string[] = [];
      const unloadedPlugins: string[] = [];

      // Add hooks for plugin lifecycle
      hookSystem.addHook(
        'plugin:loaded',
        async (data: { plugin: Plugin; duration: number }) => {
          loadedPlugins.push(data.plugin.id);
        },
        {
          priority: 'normal' as const,
          mode: 'async',
        }
      );

      hookSystem.addHook(
        'plugin:unloaded',
        async (data: { pluginId: string; duration: number }) => {
          unloadedPlugins.push(data.pluginId);
        },
        {
          priority: 'normal' as const,
          mode: 'async',
        }
      );

      // Simulate plugin events
      const mockPlugin = createMockPlugin('test-plugin');
      const pluginLoadedData = { plugin: mockPlugin, duration: 100 };
      const pluginUnloadedData = { pluginId: 'test-plugin', duration: 50 };

      // Execute hooks
      await hookSystem.executeHooks('plugin:loaded', pluginLoadedData);
      await hookSystem.executeHooks('plugin:unloaded', pluginUnloadedData);

      expect(loadedPlugins).toContain('test-plugin');
      expect(unloadedPlugins).toContain('test-plugin');
    });

    it('should handle async event processing', async () => {
      const results: string[] = [];
      const asyncHandler1 = vi.fn().mockImplementation(async () => {
        results.push('result1');
        return 'result1';
      });
      const asyncHandler2 = vi.fn().mockImplementation(async () => {
        results.push('result2');
        return 'result2';
      });

      typedEmitter.on('plugin:loaded', asyncHandler1);
      typedEmitter.on('plugin:loaded', asyncHandler2);

      const mockPlugin = createMockPlugin('async-plugin');
      const success = await typedEmitter.emitAsync('plugin:loaded', {
        type: 'plugin:loaded' as const,
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createEventId('async-plugin-loaded'),
        data: {
          plugin: mockPlugin,
          duration: 100,
        },
      });

      expect(success).toBe(true);
      expect(results).toEqual(['result1', 'result2']);
    });
  });

  describe('HookSystem and EventBus Integration', () => {
    it('should coordinate plugin loading with hooks and events', async () => {
      const loadingSteps: string[] = [];

      // Setup hooks for plugin loading process
      hookSystem.addHook(
        'plugin:beforeLoad',
        async (data: { pluginId: string; version: string }) => {
          loadingSteps.push('beforeLoad');
          eventBus.emit('plugin:loading', {
            type: 'plugin:loading',
            timestamp: Date.now(),
            source: createEventSource('test'),
            id: createEventId('loading-event'),
            data: { pluginId: data.pluginId },
          });
          return 'beforeLoad-result';
        },
        { priority: 'high' as const }
      );

      hookSystem.addHook('plugin:load', async (_data: { pluginId: string; version: string }) => {
        loadingSteps.push('load');
        return 'load-result';
      });

      hookSystem.addHook(
        'plugin:afterLoad',
        async (data: { pluginId: string; version: string }) => {
          loadingSteps.push('afterLoad');
          const mockPlugin = createMockPlugin(data.pluginId);
          eventBus.emit('plugin:loaded', {
            type: 'plugin:loaded',
            timestamp: Date.now(),
            source: createEventSource('test'),
            id: createEventId('loaded-event'),
            data: { plugin: mockPlugin, duration: 100 },
          });
          return 'afterLoad-result';
        },
        { priority: 'low' as const }
      );

      // Setup event listeners
      const loadingHandler = vi.fn();
      const loadedHandler = vi.fn();

      eventBus.on('plugin:loading', loadingHandler);
      eventBus.on('plugin:loaded', loadedHandler);

      // Execute the plugin loading process
      const pluginData = { pluginId: 'integration-plugin', version: '1.0.0' };

      const beforeResults = await hookSystem.executeHooks('plugin:beforeLoad', pluginData);
      const loadResults = await hookSystem.executeHooks('plugin:load', pluginData);
      const afterResults = await hookSystem.executeHooks('plugin:afterLoad', pluginData);

      // Verify execution order and results
      expect(loadingSteps).toEqual(['beforeLoad', 'load', 'afterLoad']);
      expect(beforeResults).toHaveLength(1);
      expect(beforeResults[0]?.success).toBe(true);
      expect(beforeResults[0]?.data).toBe('beforeLoad-result');
      expect(loadResults).toHaveLength(1);
      expect(loadResults[0]?.success).toBe(true);
      expect(loadResults[0]?.data).toBe('load-result');
      expect(afterResults).toHaveLength(1);
      expect(afterResults[0]?.success).toBe(true);
      expect(afterResults[0]?.data).toBe('afterLoad-result');

      // Verify events were emitted
      expect(loadingHandler).toHaveBeenCalled();
      expect(loadedHandler).toHaveBeenCalled();
    });

    it('should handle error propagation between hooks and events', async () => {
      const eventErrorHandler = vi.fn();

      // Setup error handlers
      eventBus.onError(eventErrorHandler);

      // Setup faulty hook
      hookSystem.addHook('test:operation', async () => {
        throw new Error('Hook execution failed');
      });

      // Setup event listener that also throws
      eventBus.on('error:occurred', () => {
        throw new Error('Event handler failed');
      });

      // Execute hook and emit error event
      const results = await hookSystem.executeHooks('test:operation', { data: 'test' });
      eventBus.emit('error:occurred', {
        type: 'error:occurred',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createEventId('error-event'),
        metadata: { message: 'Test error' },
      });

      // Verify error handling
      expect(eventErrorHandler).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toBeInstanceOf(Error);
    });
  });

  describe('Complete Event System Integration', () => {
    it('should simulate a complete plugin lifecycle', async () => {
      const lifecycleEvents: string[] = [];

      // Setup comprehensive event tracking
      const trackEvent = (event: string) => (): void => {
        lifecycleEvents.push(event);
      };

      // Setup hooks for each lifecycle stage
      hookSystem.addHook('plugin:validate', async (data: { pluginId: string; version: string }) => {
        lifecycleEvents.push('hook:validate');
        const mockPlugin = createMockPlugin(data.pluginId);
        typedEmitter.emit('plugin:loaded', {
          type: 'plugin:loaded' as const,
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createEventId('validate-event'),
          data: { plugin: mockPlugin, duration: 100 },
        });
        return 'validated';
      });

      hookSystem.addHook(
        'plugin:initialize',
        async (_data: { pluginId: string; version: string }) => {
          lifecycleEvents.push('hook:initialize');
          return 'initialized';
        }
      );

      hookSystem.addHook(
        'plugin:activate',
        async (_data: { pluginId: string; version: string }) => {
          lifecycleEvents.push('hook:activate');
          return 'activated';
        }
      );

      // Setup event listeners
      typedEmitter.on('plugin:loaded', trackEvent('event:loaded'));
      eventBus.on('plugin:*', trackEvent('event:wildcard'));

      // Execute complete lifecycle
      const pluginData = { pluginId: 'lifecycle-plugin', version: '1.0.0' };

      await hookSystem.executeHooks('plugin:validate', pluginData);
      await hookSystem.executeHooks('plugin:initialize', pluginData);
      await hookSystem.executeHooks('plugin:activate', pluginData);

      // Emit additional events
      eventBus.emit('plugin:ready', {
        type: 'plugin:ready',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createEventId('ready-event'),
        metadata: { pluginData },
      });

      typedEmitter.emit('kernel:ready', {
        type: 'kernel:ready' as const,
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createEventId('kernel-ready'),
        data: {
          info: mockKernel.info,
          loadedPlugins: ['lifecycle-plugin'],
          duration: 1000,
        },
      });

      expect(lifecycleEvents).toEqual([
        'hook:validate',
        'event:loaded', // plugin:loaded from typedEmitter
        'hook:initialize',
        'hook:activate',
        'event:wildcard', // plugin:ready is captured by wildcard listener
      ]);
    });

    it('should handle concurrent plugin operations', async () => {
      const concurrentResults: Array<{ pluginId: string; result: string }> = [];

      // Setup hook that simulates async plugin loading
      hookSystem.addHook('plugin:load', async (data: { pluginId: string; version: string }) => {
        const { pluginId } = data;
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

        const result = `loaded-${pluginId}`;
        concurrentResults.push({ pluginId, result });

        const mockPlugin = createMockPlugin(pluginId);

        typedEmitter.emit('plugin:loaded', {
          type: 'plugin:loaded' as const,
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createEventId(`load-event-${pluginId}`),
          data: { plugin: mockPlugin, duration: 100 },
        });
        return result;
      });

      // Setup event tracking
      const loadedPlugins: string[] = [];
      typedEmitter.on('plugin:loaded', data => {
        loadedPlugins.push(data.data.plugin.metadata.id as string);
      });

      // Load multiple plugins concurrently
      const plugins = [
        { pluginId: 'plugin-1', version: '1.0.0' },
        { pluginId: 'plugin-2', version: '1.0.0' },
        { pluginId: 'plugin-3', version: '1.0.0' },
        { pluginId: 'plugin-4', version: '1.0.0' },
        { pluginId: 'plugin-5', version: '1.0.0' },
      ];

      const loadPromises = plugins.map(plugin => hookSystem.executeHooks('plugin:load', plugin));

      const results = await Promise.all(loadPromises);

      // Verify all plugins were loaded
      expect(results).toHaveLength(5);
      // Each result is an array of HookResult objects
      results.forEach(hookResults => {
        expect(hookResults).toHaveLength(1); // One hook per plugin
        expect(hookResults[0]?.success).toBe(true);
      });
      expect(concurrentResults).toHaveLength(5);
      expect(loadedPlugins).toHaveLength(5);

      // Verify all plugin IDs are present
      const loadedIds = loadedPlugins.sort();
      const expectedIds = plugins.map(p => p.pluginId).sort();
      expect(loadedIds).toEqual(expectedIds);
    });

    it('should handle complex event patterns and filtering', async () => {
      const patternResults: Array<{ pattern: string; event: string; data: unknown }> = [];

      // Setup pattern listeners
      eventBus.on('plugin:*', (event, _context) => {
        patternResults.push({
          pattern: 'plugin:*',
          event: event.type,
          data: (event as BaseEvent & { data?: unknown }).data,
        });
      });

      eventBus.on('kernel:*', (event, _context) => {
        patternResults.push({
          pattern: 'kernel:*',
          event: event.type,
          data: (event as BaseEvent & { data?: unknown }).data,
        });
      });

      eventBus.on('*', (event, _context) => {
        patternResults.push({
          pattern: '*',
          event: event.type,
          data: (event as BaseEvent & { data?: unknown }).data,
        });
      });

      // Emit various events
      const mockPlugin = createMockPlugin('test-plugin');
      eventBus.emit('plugin:loaded', {
        type: 'plugin:loaded',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createEventId('pattern-test-1'),
        data: { plugin: mockPlugin, duration: 100 },
      });

      eventBus.emit('plugin:unloaded', {
        type: 'plugin:unloaded',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createEventId('pattern-test-2'),
        data: { pluginId: 'test-plugin', duration: 50 },
      });

      eventBus.emit('kernel:ready', {
        type: 'kernel:ready',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createEventId('pattern-test-3'),
        data: { info: mockKernel.info, loadedPlugins: [], duration: 1000 },
      });

      eventBus.emit('system:error', {
        type: 'system:error',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createEventId('pattern-test-4'),
        data: { error: new Error('test'), component: 'test', severity: 'low' as const },
      });

      // Verify pattern matching
      // 4 events total: 2 plugin events + 1 kernel event + 1 system event
      // Each event is captured by multiple listeners:
      // - plugin events: plugin:* + * = 2 listeners each
      // - kernel events: kernel:* + * = 2 listeners each
      // - system events: * = 1 listener each
      // Total: (2*2) + (1*2) + (1*1) = 7 events
      expect(patternResults).toHaveLength(7);

      const pluginEvents = patternResults.filter(r => r.pattern === 'plugin:*');
      const kernelEvents = patternResults.filter(r => r.pattern === 'kernel:*');
      const allEvents = patternResults.filter(r => r.pattern === '*');

      expect(pluginEvents).toHaveLength(2);
      expect(kernelEvents).toHaveLength(1);
      expect(allEvents).toHaveLength(4); // All 4 events are captured by wildcard
    });
  });

  describe('Performance Integration', () => {
    it('should handle high-frequency events efficiently', async () => {
      const eventCount = 1000;
      const receivedEvents: number[] = [];

      // Setup efficient event handler
      eventBus.on('performance:test', event => {
        receivedEvents.push(
          (event as BaseEvent & { metadata?: { id?: number } }).metadata?.id ?? 0
        );
      });

      // Emit many events quickly
      const startTime = Date.now();

      for (let i = 0; i < eventCount; i++) {
        eventBus.emit('performance:test', {
          type: 'performance:test',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createEventId(`perf-test-${i}`),
          metadata: { id: i },
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify performance and correctness
      expect(receivedEvents).toHaveLength(eventCount);
      expect(duration).toBeLessThan(100); // Should be very fast

      // Verify all events were received in order
      for (let i = 0; i < eventCount; i++) {
        expect(receivedEvents[i]).toBe(i);
      }
    });
  });
});
