import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, HookSystem } from '../../src/events/index.js';
import { TypedEventEmitter } from '../../src/events/typed-event-emitter.js';
import type {
  PluginLoadedEvent,
  PluginUnloadedEvent,
  BaseEvent,
  EventContext,
} from '../../src/types/events.js';
import type { Plugin } from '../../src/types/plugin.js';
import { createPluginId, createPluginVersion } from '../../src/types/plugin.js';
import { PerformanceTestHelper } from '../helpers/event-testing.js';
import { createUtilEventId, createEventSource } from '../../src/types/index.js';
import type { ZernKernel } from '../../src/kernel.js';

// Mock kernel for HookSystem
const mockKernel: Partial<ZernKernel> = {};

describe('Event System E2E Tests', () => {
  let eventBus: EventBus;
  let hookSystem: HookSystem;
  let typedEmitter: TypedEventEmitter;

  beforeEach(() => {
    typedEmitter = new TypedEventEmitter();
    eventBus = new EventBus();
    hookSystem = new HookSystem(mockKernel as ZernKernel, typedEmitter);
  });

  describe('Plugin Lifecycle Simulation', () => {
    it('should handle complete plugin lifecycle with events and hooks', async () => {
      const lifecycleEvents: string[] = [];
      const pluginData: Partial<Plugin> = {
        id: createPluginId('test-plugin'),
        version: createPluginVersion('1.0.0'),
      };

      // Setup lifecycle hooks
      hookSystem.addHook(
        'plugin:before-load',
        async (data: Record<string, unknown>) => {
          lifecycleEvents.push(`before-load:${(data as { pluginId: string }).pluginId}`);
          return { ...data, preprocessed: true };
        },
        { priority: 'high' }
      );

      hookSystem.addHook(
        'plugin:after-load',
        async (data: Record<string, unknown>) => {
          lifecycleEvents.push(`after-load:${(data as { pluginId: string }).pluginId}`);
          return data;
        },
        { priority: 'normal' }
      );

      hookSystem.addHook(
        'plugin:before-unload',
        async (data: Record<string, unknown>) => {
          lifecycleEvents.push(`before-unload:${(data as { pluginId: string }).pluginId}`);
          return data;
        },
        { priority: 'low' }
      );

      // Setup event listeners
      eventBus.on('plugin:loaded', async (event: BaseEvent) => {
        const pluginEvent = event as PluginLoadedEvent;
        lifecycleEvents.push(`event:loaded:${pluginEvent.data.plugin.id}`);
      });

      eventBus.on('plugin:unloaded', async (event: BaseEvent) => {
        const pluginEvent = event as PluginUnloadedEvent;
        lifecycleEvents.push(`event:unloaded:${pluginEvent.data.pluginId}`);
      });

      // Simulate plugin loading
      const beforeLoadResults = await hookSystem.executeHooks('plugin:before-load', {
        pluginId: pluginData.id,
      });
      expect(beforeLoadResults.length).toBeGreaterThan(0);
      expect(beforeLoadResults.some(result => result.success)).toBe(true);
      // Find the test hook result (the one that returns preprocessed data)
      const testHookResult = beforeLoadResults.find(
        result => result.data && (result.data as Record<string, unknown>)?.preprocessed === true
      );
      expect(testHookResult).toBeDefined();
      expect((testHookResult?.data as Record<string, unknown>)?.preprocessed).toBe(true);

      // Create proper plugin loaded event
      const pluginLoadedEvent: PluginLoadedEvent = {
        type: 'plugin:loaded',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createUtilEventId('plugin-loaded-test'),
        data: {
          plugin: pluginData as Plugin,
          duration: 100,
        },
      };
      eventBus.emit('plugin:loaded', pluginLoadedEvent);

      const afterLoadResults = await hookSystem.executeHooks('plugin:after-load', {
        pluginId: pluginData.id,
      });
      expect(afterLoadResults[0]?.success).toBe(true);

      // Simulate plugin unloading
      const beforeUnloadResults = await hookSystem.executeHooks('plugin:before-unload', {
        pluginId: pluginData.id,
      });
      expect(beforeUnloadResults[0]?.success).toBe(true);

      // Create proper plugin unloaded event
      const pluginUnloadedEvent: PluginUnloadedEvent = {
        type: 'plugin:unloaded',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createUtilEventId('plugin-unloaded-test'),
        data: {
          pluginId: pluginData.id as string,
          duration: 50,
        },
      };
      eventBus.emit('plugin:unloaded', pluginUnloadedEvent);

      // Verify lifecycle order
      expect(lifecycleEvents).toEqual([
        'before-load:test-plugin',
        'event:loaded:test-plugin',
        'after-load:test-plugin',
        'before-unload:test-plugin',
        'event:unloaded:test-plugin',
      ]);
    });

    it('should handle plugin errors gracefully', async () => {
      const successEvents: string[] = [];

      // Setup hooks with potential failures
      hookSystem.addHook('plugin:validate', async (data: Record<string, unknown>) => {
        const pluginData = data as { pluginId: string };
        if (pluginData.pluginId === 'invalid-plugin') {
          throw new Error('Plugin validation failed');
        }
        successEvents.push(`validated:${pluginData.pluginId}`);
        return data;
      });

      hookSystem.addHook('plugin:initialize', async (data: Record<string, unknown>) => {
        const pluginData = data as { pluginId: string };
        if (pluginData.pluginId === 'failing-plugin') {
          throw new Error('Plugin initialization failed');
        }
        successEvents.push(`initialized:${pluginData.pluginId}`);
        return data;
      });

      // Test valid plugin
      const validResults = await hookSystem.executeHooks('plugin:validate', {
        pluginId: 'valid-plugin',
      });
      expect(validResults[0]?.success).toBe(true);

      const validInitResults = await hookSystem.executeHooks('plugin:initialize', {
        pluginId: 'valid-plugin',
      });
      expect(validInitResults[0]?.success).toBe(true);

      // Test invalid plugin
      const invalidResults = await hookSystem.executeHooks('plugin:validate', {
        pluginId: 'invalid-plugin',
      });
      expect(invalidResults[0]?.success).toBe(false);
      expect(invalidResults[0]?.error?.message).toBe('Plugin validation failed');

      // Test failing plugin
      const failingResults = await hookSystem.executeHooks('plugin:initialize', {
        pluginId: 'failing-plugin',
      });
      expect(failingResults[0]?.success).toBe(false);
      expect(failingResults[0]?.error?.message).toBe('Plugin initialization failed');

      // Verify successful operations
      expect(successEvents).toEqual(['validated:valid-plugin', 'initialized:valid-plugin']);
    });
  });

  describe('Real-time Event Processing', () => {
    it('should handle high-frequency events in real-time', async () => {
      const processedEvents: Array<{ id: number; timestamp: number }> = [];
      const eventCount = 1000;

      // Setup high-frequency event handler
      eventBus.on('realtime:data', async (event: BaseEvent) => {
        processedEvents.push({
          id: (event.metadata?.eventId as number) || 0,
          timestamp: Date.now(),
        });
      });

      // Emit events rapidly
      const startTime = Date.now();

      for (let i = 0; i < eventCount; i++) {
        const realtimeEvent: BaseEvent = {
          type: 'realtime:data',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createUtilEventId(`realtime-${i}`),
          metadata: {
            eventId: i,
            value: Math.random(),
          } as const,
        };
        eventBus.emit('realtime:data', realtimeEvent);
      }

      const endTime = Date.now();

      // Verify all events were processed
      expect(processedEvents).toHaveLength(eventCount);

      // Verify events were processed in order
      for (let i = 0; i < eventCount; i++) {
        expect(processedEvents[i]?.id).toBe(i);
      }

      // Verify performance (should be very fast)
      expect(endTime - startTime).toBeLessThan(150); // Adjusted for CI environment
    });

    it('should handle concurrent async operations', async () => {
      const results: Array<{ operation: string; result: string; duration: number }> = [];

      // Setup async operations with different durations
      const operations = [
        { name: 'fast', duration: 10 },
        { name: 'medium', duration: 50 },
        { name: 'slow', duration: 100 },
      ];

      // Setup hooks for each operation
      operations.forEach(op => {
        hookSystem.addHook(`operation:${op.name}`, async (_context: EventContext) => {
          const start = Date.now();
          await new Promise(resolve => setTimeout(resolve, op.duration));
          const end = Date.now();

          const result = {
            operation: op.name,
            result: `completed-${op.name}`,
            duration: end - start,
          };

          results.push(result);
          return result;
        });
      });

      // Execute operations concurrently
      const promises = operations.map(op =>
        hookSystem.executeHooks(`operation:${op.name}`, { operation: op.name })
      );

      const hookResults = await Promise.all(promises);

      // Verify all operations completed
      expect(results).toHaveLength(3);
      expect(hookResults).toHaveLength(3);

      // Verify operations completed in expected time ranges
      const fastResult = results.find(r => r.operation === 'fast');
      const mediumResult = results.find(r => r.operation === 'medium');
      const slowResult = results.find(r => r.operation === 'slow');

      expect(fastResult?.duration).toBeGreaterThanOrEqual(8); // Slightly more lenient for CI
      expect(fastResult?.duration).toBeLessThan(60); // Adjusted for CI environment

      expect(mediumResult?.duration).toBeGreaterThanOrEqual(45); // More lenient for CI timing variations
      expect(mediumResult?.duration).toBeLessThan(110); // Adjusted for CI environment

      expect(slowResult?.duration).toBeGreaterThanOrEqual(95); // Slightly more lenient for CI
      expect(slowResult?.duration).toBeLessThan(130);
    });
  });

  describe('Complex Event Patterns', () => {
    it('should handle complex event routing and filtering', async () => {
      const routedEvents: {
        user: Array<{ event: string; data: BaseEvent }>;
        admin: Array<{ event: string; data: BaseEvent }>;
        system: Array<{ event: string; data: BaseEvent }>;
        audit: Array<{ event: string; data: BaseEvent; timestamp?: number }>;
      } = {
        user: [],
        admin: [],
        system: [],
        audit: [],
      };

      // Setup event routing based on patterns
      eventBus.on('user:*', async (event: BaseEvent) => {
        routedEvents.user.push({ event: event.type, data: event });
      });

      eventBus.on('admin:*', async (event: BaseEvent) => {
        routedEvents.admin.push({ event: event.type, data: event });
      });

      eventBus.on('system:*', async (event: BaseEvent) => {
        routedEvents.system.push({ event: event.type, data: event });
      });

      // Setup audit logging for all events
      eventBus.on('*', async (event: BaseEvent) => {
        if (!event.type.startsWith('audit:')) {
          routedEvents.audit.push({ event: event.type, data: event, timestamp: Date.now() });
        }
      });

      // Emit various events
      const events: BaseEvent[] = [
        {
          type: 'user:login',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createUtilEventId('user-login'),
          metadata: { userId: 1, ip: '192.168.1.1' } as const,
        },
        {
          type: 'user:logout',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createUtilEventId('user-logout'),
          metadata: { userId: 1 } as const,
        },
        {
          type: 'admin:user:created',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createUtilEventId('admin-user-created'),
          metadata: { adminId: 1, userId: 2 } as const,
        },
        {
          type: 'admin:settings:changed',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createUtilEventId('admin-settings-changed'),
          metadata: { adminId: 1, setting: 'theme' } as const,
        },
        {
          type: 'system:error',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createUtilEventId('system-error'),
          metadata: { message: 'Database connection failed' } as const,
        },
        {
          type: 'system:startup',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createUtilEventId('system-startup'),
          metadata: { version: '1.0.0' } as const,
        },
      ];

      events.forEach(event => {
        eventBus.emit(event.type, event);
      });

      // Verify routing
      expect(routedEvents.user).toHaveLength(2);
      expect(routedEvents.admin).toHaveLength(2);
      expect(routedEvents.system).toHaveLength(2);
      expect(routedEvents.audit).toHaveLength(6); // All events

      // Verify specific routing
      expect(routedEvents.user[0]?.event).toBe('user:login');
      expect(routedEvents.user[1]?.event).toBe('user:logout');
      expect(routedEvents.admin[0]?.event).toBe('admin:user:created');
      expect(routedEvents.admin[1]?.event).toBe('admin:settings:changed');
    });

    it('should handle event transformation and middleware', async () => {
      const transformedEvents: Array<{ eventName: string; data: Record<string, unknown> }> = [];
      const originalEvents: Array<{ eventName: string; data: Record<string, unknown> }> = [];

      // Setup middleware hook that transforms events
      hookSystem.addHook('event:transform', async (data: Record<string, unknown>) => {
        const { eventName, data: eventData } = data as {
          eventName: string;
          data: Record<string, unknown>;
        };
        originalEvents.push({ eventName, data: eventData });

        // Transform the event data
        const transformed = {
          ...eventData,
          timestamp: Date.now(),
          source: 'middleware',
          transformed: true,
        };

        transformedEvents.push({ eventName, data: transformed });
        return transformed;
      });

      // Setup event listener that receives transformed data
      eventBus.on('data:processed', async (event: BaseEvent) => {
        expect(event.metadata?.transformed).toBe(true);
        expect(event.metadata?.timestamp).toBeDefined();
        expect(event.metadata?.source).toBe('middleware');
      });

      // Process events through middleware
      const eventsToProcess = [
        { eventName: 'user:action', data: { action: 'click', element: 'button' } },
        { eventName: 'system:metric', data: { metric: 'cpu', value: 75 } },
        { eventName: 'plugin:event', data: { pluginId: 'test', event: 'custom' } },
      ];

      for (const event of eventsToProcess) {
        const results = await hookSystem.executeHooks('event:transform', event);
        if (results.length > 0 && results[0]?.success) {
          const processedEvent: BaseEvent = {
            type: 'data:processed',
            timestamp: Date.now(),
            source: createEventSource('test'),
            id: createUtilEventId('data-processed'),
            metadata: results[0].data as Record<string, unknown>,
          };
          eventBus.emit('data:processed', processedEvent);
        }
      }

      // Verify transformation
      expect(originalEvents).toHaveLength(3);
      expect(transformedEvents).toHaveLength(3);

      transformedEvents.forEach((transformed, index) => {
        expect(transformed.data.transformed).toBe(true);
        expect(transformed.data.timestamp).toBeDefined();
        expect(transformed.data.source).toBe('middleware');

        // Verify original data is preserved
        const original = originalEvents[index];
        if (original) {
          Object.keys(original.data).forEach(key => {
            expect(transformed.data[key]).toEqual(original.data[key]);
          });
        }
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain performance with many listeners and events', async () => {
      const listenerCount = 100;
      const eventCount = 1000;
      const listeners: Array<ReturnType<typeof vi.fn>> = [];

      // Setup many listeners
      for (let i = 0; i < listenerCount; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        eventBus.on('benchmark:test', listener);
      }

      // Measure performance
      const { emitDuration } = await PerformanceTestHelper.benchmarkEvents(
        eventBus,
        eventCount,
        listenerCount
      );

      // Verify performance (should handle 1000 events with 100 listeners quickly)
      expect(emitDuration).toBeLessThan(2000); // Less than 2 seconds (adjusted for CI environment)

      // Verify all listeners were called for all events
      listeners.forEach(listener => {
        expect(listener).toHaveBeenCalledTimes(eventCount);
      });
    });

    it('should handle memory efficiently with many hooks', async () => {
      // Create a fresh HookSystem for this test to avoid interference
      const freshTypedEmitter = new TypedEventEmitter();
      const freshHookSystem = new HookSystem(mockKernel as ZernKernel, freshTypedEmitter);

      const hookCount = 100;
      const executionCount = 100;

      // Setup many hooks
      for (let i = 0; i < hookCount; i++) {
        freshHookSystem.addHook('memory:test', async () => `result-${i}`);
      }

      // Verify hook count before performance test
      const actualHookCount = freshHookSystem.getHookCount('memory:test');
      expect(actualHookCount).toBe(hookCount);

      // Measure performance
      const { executionDuration } = await PerformanceTestHelper.benchmarkHooks(
        freshHookSystem,
        executionCount,
        hookCount
      );

      // Verify performance
      expect(executionDuration).toBeLessThan(2000); // Less than 2 seconds
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from cascading failures', async () => {
      const errorLog: Array<{ stage: string; error: string }> = [];
      const successLog: string[] = [];

      // Setup hooks with various failure points
      hookSystem.addHook('process:step1', async () => {
        successLog.push('step1');
        return 'step1-complete';
      });

      hookSystem.addHook('process:step2', async () => {
        throw new Error('Step 2 failed');
      });

      hookSystem.addHook('process:step3', async () => {
        successLog.push('step3');
        return 'step3-complete';
      });

      // Setup event handlers with failures
      eventBus.on('process:notify', async () => {
        throw new Error('Notification failed');
      });

      eventBus.on('process:cleanup', async () => {
        successLog.push('cleanup');
      });

      // Execute process with failures
      await hookSystem.executeHooks('process:step1', { data: 'test' });
      const step2Results = await hookSystem.executeHooks('process:step2', { data: 'test' });
      await hookSystem.executeHooks('process:step3', { data: 'test' });

      // Check for errors in hook results
      if (step2Results[0] && !step2Results[0].success) {
        errorLog.push({
          stage: 'process:step2',
          error: step2Results[0].error?.message || 'Unknown error',
        });
      }

      try {
        const notifyEvent: BaseEvent = {
          type: 'process:notify',
          timestamp: Date.now(),
          source: createEventSource('test'),
          id: createUtilEventId('process-notify'),
          metadata: { message: 'Process complete' } as const,
        };
        eventBus.emit('process:notify', notifyEvent);
      } catch (error) {
        errorLog.push({ stage: 'process:notify', error: (error as Error).message });
      }

      const cleanupEvent: BaseEvent = {
        type: 'process:cleanup',
        timestamp: Date.now(),
        source: createEventSource('test'),
        id: createUtilEventId('process-cleanup'),
        metadata: { message: 'Cleaning up' } as const,
      };
      eventBus.emit('process:cleanup', cleanupEvent);

      // Verify error recovery
      expect(errorLog).toHaveLength(1);
      expect(errorLog[0]?.stage).toBe('process:step2');

      // Verify successful operations continued
      expect(successLog).toEqual(['step1', 'step3', 'cleanup']);
    });
  });
});
