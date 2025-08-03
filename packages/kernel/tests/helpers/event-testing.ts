import { expect, vi, type MockedFunction } from 'vitest';
import { EventBus, HookSystem } from '../../src/events/index.js';
import type {
  EventListener,
  HookHandler,
  BaseEvent,
  EventSubscriptionId,
} from '../../src/events/index.js';
import { TypedEventEmitter } from '../../src/events/typed-event-emitter.js';
import { performance } from 'perf_hooks';
import { createUtilEventId, createEventSource } from '../../src/types/index.js';
import type { ZernKernel } from '../../src/kernel.js';

// Event testing utilities
export class EventTestHelper {
  private eventBus: EventBus;
  private listeners: Map<string, MockedFunction<EventListener<BaseEvent>>[]> = new Map();

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus || new EventBus();
  }

  /**
   * Creates a mock listener and registers it for an event
   */
  createMockListener(eventName: string): MockedFunction<EventListener<BaseEvent>> {
    const listener = vi.fn();
    this.eventBus.on(eventName, listener);

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)!.push(listener);

    return listener;
  }

  /**
   * Creates multiple mock listeners for an event
   */
  createMockListeners(
    eventName: string,
    count: number
  ): MockedFunction<EventListener<BaseEvent>>[] {
    const listeners: MockedFunction<EventListener<BaseEvent>>[] = [];
    for (let i = 0; i < count; i++) {
      listeners.push(this.createMockListener(eventName));
    }
    return listeners;
  }

  /**
   * Verifies that all listeners for an event were called with specific data
   */
  expectAllListenersCalled(eventName: string, data?: unknown): void {
    const listeners = this.listeners.get(eventName) || [];
    listeners.forEach(listener => {
      if (data !== undefined) {
        expect(listener).toHaveBeenCalledWith(data);
      } else {
        expect(listener).toHaveBeenCalled();
      }
    });
  }

  /**
   * Verifies that no listeners for an event were called
   */
  expectNoListenersCalled(eventName: string): void {
    const listeners = this.listeners.get(eventName) || [];
    listeners.forEach(listener => {
      expect(listener).not.toHaveBeenCalled();
    });
  }

  /**
   * Gets the call count for all listeners of an event
   */
  getCallCount(eventName: string): number {
    const listeners = this.listeners.get(eventName) || [];
    return listeners.reduce((total, listener) => total + listener.mock.calls.length, 0);
  }

  /**
   * Clears all mock listeners
   */
  clearMocks(): void {
    this.listeners.forEach(listeners => {
      listeners.forEach(listener => listener.mockClear());
    });
  }

  /**
   * Removes all listeners and clears mocks
   */
  cleanup(): void {
    this.eventBus.removeAllListeners();
    this.listeners.clear();
  }

  /**
   * Gets the underlying EventBus instance
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }
}

// Hook testing utilities
export class HookTestHelper {
  private hookSystem: HookSystem;
  private handlers: Map<string, MockedFunction<HookHandler>[]> = new Map();

  constructor(hookSystem?: HookSystem) {
    if (hookSystem) {
      this.hookSystem = hookSystem;
    } else {
      // Create mock kernel and event emitter for testing
      const mockKernel = {
        getLogger: (): Record<string, MockedFunction<(...args: unknown[]) => void>> => ({
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        }),
      } as unknown as ZernKernel;

      const eventEmitter = new TypedEventEmitter();
      this.hookSystem = new HookSystem(mockKernel, eventEmitter);
    }
  }

  /**
   * Creates a mock hook handler and registers it
   */
  createMockHandler(
    hookName: string,
    returnValue?: unknown,
    config?: Parameters<HookSystem['addHook']>[2]
  ): MockedFunction<HookHandler> {
    const handler = vi.fn().mockResolvedValue(returnValue);
    this.hookSystem.addHook(hookName, handler, config);

    if (!this.handlers.has(hookName)) {
      this.handlers.set(hookName, []);
    }
    this.handlers.get(hookName)!.push(handler);

    return handler;
  }

  /**
   * Creates multiple mock handlers for a hook
   */
  createMockHandlers(
    hookName: string,
    count: number,
    returnValues?: unknown[]
  ): MockedFunction<HookHandler>[] {
    const handlers: MockedFunction<HookHandler>[] = [];
    for (let i = 0; i < count; i++) {
      const returnValue = returnValues?.[i] || `result-${i}`;
      handlers.push(this.createMockHandler(hookName, returnValue));
    }
    return handlers;
  }

  /**
   * Executes a hook and returns the results
   */
  async executeHook(hookName: string, context?: unknown): Promise<unknown[]> {
    const results = await this.hookSystem.executeHooks(hookName, context || { data: 'test' });
    return results || [];
  }

  /**
   * Verifies that all handlers for a hook were called
   */
  expectAllHandlersCalled(hookName: string, context?: unknown): void {
    const handlers = this.handlers.get(hookName) || [];
    handlers.forEach(handler => {
      if (context !== undefined) {
        expect(handler).toHaveBeenCalledWith(context);
      } else {
        expect(handler).toHaveBeenCalled();
      }
    });
  }

  /**
   * Verifies that handlers were called in the correct order
   */
  expectHandlersCalledInOrder(hookName: string): void {
    const handlers = this.handlers.get(hookName) || [];
    if (handlers.length < 2) return;

    for (let i = 1; i < handlers.length; i++) {
      const prevHandler = handlers[i - 1];
      const currentHandler = handlers[i];

      if (
        prevHandler &&
        currentHandler &&
        prevHandler.mock.invocationCallOrder &&
        currentHandler.mock.invocationCallOrder
      ) {
        const prevOrder = prevHandler.mock.invocationCallOrder[0];
        const currentOrder = currentHandler.mock.invocationCallOrder[0];

        if (prevOrder !== undefined && currentOrder !== undefined) {
          expect(prevOrder).toBeLessThan(currentOrder);
        }
      }
    }
  }

  /**
   * Clears all mock handlers
   */
  clearMocks(): void {
    this.handlers.forEach(handlers => {
      handlers.forEach(handler => handler.mockClear());
    });
  }

  /**
   * Removes all hooks and clears mocks
   */
  cleanup(): void {
    // Remove all registered hooks
    const allHooks = this.hookSystem.getHooks();
    allHooks.forEach(hook => this.hookSystem.removeHook(hook.id));
    this.handlers.clear();
  }

  /**
   * Gets the underlying HookSystem instance
   */
  getHookSystem(): HookSystem {
    return this.hookSystem;
  }
}

// Performance testing utilities
export class PerformanceTestHelper {
  /**
   * Measures the execution time of a function
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, duration: end - start };
  }

  /**
   * Measures the execution time of a synchronous function
   */
  static measureTimeSync<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    return { result, duration: end - start };
  }

  /**
   * Creates a performance benchmark for event operations
   */
  static async benchmarkEvents(
    eventBus: EventBus,
    eventCount: number,
    listenerCount: number = 1
  ): Promise<{ emitDuration: number; totalDuration: number }> {
    // Setup listeners
    const listeners = Array.from({ length: listenerCount }, () => vi.fn());
    listeners.forEach(listener => {
      const handler = async (event: BaseEvent, _context: unknown): Promise<void> => {
        listener(event);
      };
      eventBus.on('benchmark:test', handler);
    });

    // Measure emit time
    const { duration: emitDuration } = await this.measureTime(async () => {
      for (let i = 0; i < eventCount; i++) {
        eventBus.emit('benchmark:test', {
          type: 'benchmark:test',
          timestamp: Date.now(),
          source: createEventSource('benchmark'),
          id: createUtilEventId(`benchmark-${i}`),
          metadata: { id: `benchmark-${i}` },
        });
      }
    });

    // Cleanup
    eventBus.removeAllListeners();

    return { emitDuration, totalDuration: emitDuration };
  }

  /**
   * Creates a performance benchmark for hook operations
   */
  static async benchmarkHooks(
    hookSystem: HookSystem,
    hookCount: number,
    handlerCount: number = 1
  ): Promise<{ executionDuration: number; totalDuration: number }> {
    // Setup handlers
    for (let i = 0; i < handlerCount; i++) {
      hookSystem.addHook('benchmark:test', async () => `result-${i}`);
    }

    // Measure execution time
    const { duration: executionDuration } = await this.measureTime(async () => {
      for (let i = 0; i < hookCount; i++) {
        await hookSystem.executeHooks('benchmark:test', { data: `test-${i}` });
      }
    });

    // Cleanup
    const allHooks = hookSystem.getHooks();
    allHooks.forEach(hook => hookSystem.removeHook(hook.id));

    return { executionDuration, totalDuration: executionDuration };
  }
}

// Error testing utilities
export class ErrorTestHelper {
  /**
   * Creates a handler that throws an error
   */
  static createErrorHandler(message: string = 'Test error'): () => never {
    return () => {
      throw new Error(message);
    };
  }

  /**
   * Creates an async handler that rejects
   */
  static createAsyncErrorHandler(message: string = 'Async test error'): () => Promise<never> {
    return async () => {
      throw new Error(message);
    };
  }

  /**
   * Creates a handler that throws after a delay
   */
  static createDelayedErrorHandler(
    delay: number,
    message: string = 'Delayed test error'
  ): () => Promise<never> {
    return async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      throw new Error(message);
    };
  }

  /**
   * Verifies that an error handler was called with the expected error
   */
  static expectErrorHandlerCalled(
    errorHandler: MockedFunction<(...args: unknown[]) => unknown>,
    expectedMessage?: string,
    expectedEvent?: string,
    expectedData?: unknown
  ): void {
    expect(errorHandler).toHaveBeenCalled();

    const firstCall = errorHandler.mock.calls[0];
    if (firstCall && Array.isArray(firstCall) && firstCall.length >= 1) {
      const [error, event, data] = firstCall;
      expect(error).toBeInstanceOf(Error);

      if (expectedMessage && error instanceof Error) {
        expect(error.message).toBe(expectedMessage);
      }

      if (expectedEvent) {
        expect(event).toBe(expectedEvent);
      }

      if (expectedData !== undefined) {
        expect(data).toEqual(expectedData);
      }
    }
  }
}

// Async testing utilities
export class AsyncTestHelper {
  /**
   * Waits for a condition to be true
   */
  static async waitFor(
    condition: () => boolean,
    timeout: number = 1000,
    interval: number = 10
  ): Promise<void> {
    const start = Date.now();

    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error(`Timeout waiting for condition after ${timeout}ms`);
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  /**
   * Waits for an event to be emitted
   */
  static async waitForEvent(
    eventBus: EventBus,
    eventName: string,
    timeout: number = 1000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let subscriptionId: EventSubscriptionId | undefined;

      const timer = setTimeout(() => {
        if (subscriptionId) {
          eventBus.off(subscriptionId);
        }
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);

      const handler = async (event: BaseEvent, _context: unknown): Promise<void> => {
        clearTimeout(timer);
        if (subscriptionId) {
          eventBus.off(subscriptionId);
        }
        resolve(event);
      };

      subscriptionId = eventBus.once(eventName, handler);
    });
  }

  /**
   * Creates a promise that resolves after a delay
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
