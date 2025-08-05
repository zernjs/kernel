import { describe, it, expect } from 'vitest';
import {
  EventBus,
  TypedEventEmitter,
  HookSystem,
  type HookPriority,
  type HookMode,
  type HookHandler,
  type HookContext,
  type HookConfig,
  type HookRegistration,
  type HookResult,
  type EventListener,
  type EventSubscription,
  type ErrorHandler,
  type BaseEvent,
} from './index.js';
import type { ZernKernel } from '../kernel.js';
import { createKernelId, createKernelVersion, createEventSubscriptionId } from '../types/index.js';

describe('Events Module Exports', () => {
  describe('Class Exports', () => {
    it('should export EventBus class', () => {
      expect(EventBus).toBeDefined();
      expect(typeof EventBus).toBe('function');

      const eventBus = new EventBus();
      expect(eventBus).toBeInstanceOf(EventBus);
      expect(typeof eventBus.on).toBe('function');
      expect(typeof eventBus.emit).toBe('function');
    });

    it('should export TypedEventEmitter class', () => {
      expect(TypedEventEmitter).toBeDefined();
      expect(typeof TypedEventEmitter).toBe('function');

      const emitter = new TypedEventEmitter();
      expect(emitter).toBeInstanceOf(TypedEventEmitter);
      expect(typeof emitter.on).toBe('function');
      expect(typeof emitter.emit).toBe('function');
    });

    it('should export HookSystem class', () => {
      expect(HookSystem).toBeDefined();
      expect(typeof HookSystem).toBe('function');

      // Create mock kernel for HookSystem constructor
      const mockKernel = {
        id: createKernelId('test-kernel'),
        version: createKernelVersion('1.0.0'),
      } as unknown as ZernKernel;

      const eventEmitter = new TypedEventEmitter();
      const hookSystem = new HookSystem(mockKernel, eventEmitter);
      expect(hookSystem).toBeInstanceOf(HookSystem);
      expect(typeof hookSystem.addHook).toBe('function');
      expect(typeof hookSystem.executeHooks).toBe('function');
    });
  });

  describe('Type Exports', () => {
    it('should export HookPriority type', () => {
      // HookPriority is a type union, not an enum
      const priorities: HookPriority[] = ['highest', 'high', 'normal', 'low', 'lowest'];
      expect(priorities).toContain('highest');
      expect(priorities).toContain('high');
      expect(priorities).toContain('normal');
      expect(priorities).toContain('low');
      expect(priorities).toContain('lowest');
    });

    it('should export HookMode type', () => {
      // HookMode is a type union, not an enum
      const modes: HookMode[] = ['sync', 'async', 'parallel', 'sequential'];
      expect(modes).toContain('sync');
      expect(modes).toContain('async');
      expect(modes).toContain('parallel');
      expect(modes).toContain('sequential');
    });

    it('should export hook-related types', () => {
      // These are compile-time checks, so we just verify they can be imported
      const handler: HookHandler = async () => 'result';

      // Create a proper mock kernel for HookContext
      const mockKernel = {
        id: createKernelId('test-kernel'),
        version: createKernelVersion('1.0.0'),
      } as unknown as ZernKernel;

      const context: HookContext = {
        name: 'test-hook',
        kernel: mockKernel,
        plugin: undefined,
        metadata: {
          timestamp: Date.now(),
          executionId: 'test-exec-id',
          phase: 'during',
        },
        cancel: () => {},
        isCancelled: () => false,
      };

      const config: HookConfig = { priority: 'normal' };
      const registration: HookRegistration = {
        id: createEventSubscriptionId('test-hook-id'),
        name: 'test-hook',
        handler: async () => 'result',
        config: {
          priority: 'normal',
          mode: 'async',
          timeout: 5000,
          cancellable: false,
          plugin: undefined,
          description: undefined,
        },
        active: true,
      };
      const result: HookResult = {
        success: true,
        data: 'result',
        executionTime: 100,
        hookId: createEventSubscriptionId('test-hook-id'),
      };

      expect(handler).toBeDefined();
      expect(context).toBeDefined();
      expect(config).toBeDefined();
      expect(registration).toBeDefined();
      expect(result).toBeDefined();
    });

    it('should export event-related types', () => {
      // These are compile-time checks, so we just verify they can be imported
      const listener: EventListener<BaseEvent> = () => {};
      const subscription: EventSubscription = {
        id: createEventSubscriptionId('test-subscription'),
        pattern: 'test:event',
        handler: async () => {},
        options: {
          handler: async () => {},
          priority: 'normal',
          once: false,
        },
        unsubscribe: () => {},
      };
      const errorHandler: ErrorHandler = () => {};

      expect(listener).toBeDefined();
      expect(subscription).toBeDefined();
      expect(errorHandler).toBeDefined();
    });
  });

  describe('Integration', () => {
    it('should allow classes to work together', () => {
      const eventBus = new EventBus();
      const emitter = new TypedEventEmitter();

      // Create mock kernel for HookSystem
      const mockKernel = {
        id: createKernelId('test-kernel'),
        version: createKernelVersion('1.0.0'),
      } as unknown as ZernKernel;

      const hookSystem = new HookSystem(mockKernel, emitter);

      // Verify they can be instantiated and have expected methods
      expect(eventBus.on).toBeDefined();
      expect(emitter.on).toBeDefined();
      expect(hookSystem.addHook).toBeDefined();

      // Verify TypedEventEmitter can access EventBus
      const underlyingBus = emitter.getEventBus();
      expect(underlyingBus).toBeInstanceOf(EventBus);
    });
  });
});
