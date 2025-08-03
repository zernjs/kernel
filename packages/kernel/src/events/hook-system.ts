/**
 * @fileoverview Hook system for lifecycle and custom hooks
 * @module @zern/kernel/events/hook-system
 */

import type { EventSubscriptionId, Awaitable, PluginId } from '../types';
import type { ZernKernel } from '../kernel.js';
import {
  createEventSubscriptionId,
  createEventSource,
  createUtilEventId,
  createKernelName,
  createKernelVersion,
  createKernelId,
  createPluginVersion,
  createNodeVersion,
} from '../types';
import { TypedEventEmitter } from './typed-event-emitter.js';

/**
 * Hook execution priority
 */
export type HookPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest';

/**
 * Hook execution mode
 */
export type HookMode = 'sync' | 'async' | 'parallel' | 'sequential';

/**
 * Hook configuration
 */
export interface HookConfig {
  /** Hook priority */
  priority?: HookPriority;
  /** Execution mode */
  mode?: HookMode;
  /** Timeout for hook execution */
  timeout?: number;
  /** Whether hook can be cancelled */
  cancellable?: boolean;
  /** Plugin that registered the hook */
  plugin?: PluginId;
  /** Hook description */
  description?: string;
}

/**
 * Internal hook configuration with required fields
 */
interface InternalHookConfig {
  priority: HookPriority;
  mode: HookMode;
  timeout: number;
  cancellable: boolean;
  plugin: PluginId | undefined;
  description: string | undefined;
}

/**
 * Hook handler function
 */
export type HookHandler<T = unknown, R = unknown> = (data: T, context: HookContext) => Awaitable<R>;

/**
 * Hook context
 */
export interface HookContext {
  /** Hook name */
  name: string;
  /** Kernel instance */
  kernel: ZernKernel;
  /** Plugin that triggered the hook */
  plugin: PluginId | undefined;
  /** Hook execution metadata */
  metadata: {
    timestamp: number;
    executionId: string;
    phase: 'before' | 'during' | 'after';
  };
  /** Cancel hook execution */
  cancel(): void;
  /** Check if hook was cancelled */
  isCancelled(): boolean;
}

/**
 * Hook registration
 */
export interface HookRegistration {
  id: EventSubscriptionId;
  name: string;
  handler: HookHandler<unknown, unknown>;
  config: InternalHookConfig;
  active: boolean;
}

/**
 * Hook execution result
 */
export interface HookResult<T = unknown> {
  /** Whether execution was successful */
  success: boolean;
  /** Result data */
  data?: T;
  /** Error if execution failed */
  error?: Error;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Hook that produced this result */
  hookId: EventSubscriptionId;
}

/**
 * Hook system implementation
 */
export class HookSystem {
  private readonly _hooks = new Map<string, Set<HookRegistration>>();
  private readonly _registrations = new Map<EventSubscriptionId, HookRegistration>();
  private readonly _eventEmitter: TypedEventEmitter;
  private readonly _kernel: ZernKernel;

  constructor(kernel: ZernKernel, eventEmitter: TypedEventEmitter) {
    this._kernel = kernel;
    this._eventEmitter = eventEmitter;

    // Register lifecycle hooks automatically
    this.registerLifecycleHooks();
  }

  /**
   * Register a hook handler
   */
  addHook<T = unknown, R = unknown>(
    name: string,
    handler: HookHandler<T, R>,
    config: HookConfig = {}
  ): EventSubscriptionId {
    const id = createEventSubscriptionId(`hook-${name}-${Date.now()}-${Math.random()}`);

    const internalConfig: InternalHookConfig = {
      priority: config.priority || 'normal',
      mode: config.mode || 'async',
      timeout: config.timeout || 5000,
      cancellable: config.cancellable || false,
      plugin: config.plugin,
      description: config.description,
    };

    const registration: HookRegistration = {
      id,
      name,
      handler: handler as HookHandler<unknown, unknown>,
      config: internalConfig,
      active: true,
    };

    if (!this._hooks.has(name)) {
      this._hooks.set(name, new Set());
    }

    this._hooks.get(name)!.add(registration);
    this._registrations.set(id, registration);

    return id;
  }

  /**
   * Remove a hook handler
   */
  removeHook(id: EventSubscriptionId): boolean {
    const registration = this._registrations.get(id);
    if (!registration) {
      return false;
    }

    const hooks = this._hooks.get(registration.name);
    if (hooks) {
      hooks.delete(registration);
      if (hooks.size === 0) {
        this._hooks.delete(registration.name);
      }
    }

    this._registrations.delete(id);
    return true;
  }

  /**
   * Remove all hooks for a plugin
   */
  removePluginHooks(pluginId: PluginId): number {
    let removed = 0;

    for (const [id, registration] of this._registrations) {
      if (registration.config.plugin === pluginId) {
        this.removeHook(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Execute hooks for a given name
   */
  async executeHooks<T = unknown, R = unknown>(
    name: string,
    data: T,
    options: {
      plugin?: PluginId;
      timeout?: number;
      mode?: HookMode;
    } = {}
  ): Promise<HookResult<R>[]> {
    const hooks = this._hooks.get(name);
    if (!hooks || hooks.size === 0) {
      return [];
    }

    const activeHooks = Array.from(hooks).filter(hook => hook.active);
    if (activeHooks.length === 0) {
      return [];
    }

    // Sort by priority
    activeHooks.sort((a, b) => this._comparePriority(a.config.priority, b.config.priority));

    const context = this._createHookContext(name, options.plugin);
    const mode = options.mode || 'async';
    const timeout = options.timeout || 5000;

    switch (mode) {
      case 'sync':
        return this._executeSyncHooks<T, R>(activeHooks, data, context, timeout);
      case 'async':
        return this._executeAsyncHooks<T, R>(activeHooks, data, context, timeout);
      case 'parallel':
        return this._executeParallelHooks<T, R>(activeHooks, data, context, timeout);
      default:
        throw new Error(`Unknown hook execution mode: ${mode}`);
    }
  }

  /**
   * Execute a single hook and return result
   */
  async executeHook<T = unknown, R = unknown>(
    name: string,
    data: T,
    hookId: EventSubscriptionId,
    options: {
      plugin?: PluginId;
      timeout?: number;
    } = {}
  ): Promise<HookResult<R> | null> {
    const registration = this._registrations.get(hookId);
    if (!registration || registration.name !== name || !registration.active) {
      return null;
    }

    const context = this._createHookContext(name, options.plugin);
    const timeout = options.timeout || registration.config.timeout;

    return this._executeHook<T, R>(registration, data, context, timeout);
  }

  /**
   * Get all registered hooks
   */
  getHooks(name?: string): HookRegistration[] {
    if (name) {
      const hooks = this._hooks.get(name);
      return hooks ? Array.from(hooks) : [];
    }

    return Array.from(this._registrations.values());
  }

  /**
   * Check if a hook exists
   */
  hasHook(name: string): boolean {
    const hooks = this._hooks.get(name);
    return hooks ? hooks.size > 0 : false;
  }

  /**
   * Get hook count for a name
   */
  getHookCount(name: string): number {
    const hooks = this._hooks.get(name);
    return hooks ? hooks.size : 0;
  }

  /**
   * Register lifecycle hooks
   */
  registerLifecycleHooks(): void {
    // Kernel lifecycle hooks
    this.addHook<unknown, void>(
      'kernel:before-start',
      async (_data, _context) => {
        await this._eventEmitter.emitAsync('kernel:starting', {
          type: 'kernel:starting',
          timestamp: Date.now(),
          source: createEventSource('kernel'),
          id: createUtilEventId(`kernel-starting-${Date.now()}`),
          data: { pluginCount: 0 },
        });
      },
      { priority: 'highest', mode: 'async' }
    );

    this.addHook<unknown, void>(
      'kernel:after-start',
      async (_data, _context) => {
        await this._eventEmitter.emitAsync('kernel:ready', {
          type: 'kernel:ready',
          timestamp: Date.now(),
          source: createEventSource('kernel'),
          id: createUtilEventId(`kernel-ready-${Date.now()}`),
          data: {
            info: {
              id: createKernelId('zern-kernel'),
              name: createKernelName('zern-kernel'),
              version: createKernelVersion('1.0.0'),
              state: 'ready' as const,
              environment: 'development' as const,
              startedAt: Date.now(),
              uptime: 0,
              nodeVersion: createNodeVersion(process.version),
              platform: {
                arch: process.arch,
                platform: process.platform,
                release: process.release.name || 'unknown',
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
            loadedPlugins: [],
            duration: 0,
          },
        });
      },
      { priority: 'lowest', mode: 'async' }
    );

    // Plugin lifecycle hooks
    this.addHook<{ id: PluginId }, void>(
      'plugin:before-load',
      async (data, _context) => {
        await this._eventEmitter.emitAsync('plugin:loading', {
          type: 'plugin:loading',
          timestamp: Date.now(),
          source: createEventSource('kernel'),
          id: createUtilEventId(`plugin-loading-${Date.now()}`),
          data: { pluginId: data.id },
        });
      },
      { priority: 'highest', mode: 'async' }
    );

    this.addHook<{ id: PluginId }, void>(
      'plugin:after-load',
      async (data, _context) => {
        await this._eventEmitter.emitAsync('plugin:loaded', {
          type: 'plugin:loaded',
          timestamp: Date.now(),
          source: createEventSource('kernel'),
          id: createUtilEventId(`plugin-loaded-${Date.now()}`),
          data: {
            plugin: {
              id: data.id,
              name: data.id,
              version: createPluginVersion('1.0.0'),
              metadata: {
                id: data.id,
                version: createPluginVersion('1.0.0'),
                name: data.id,
                description: 'Plugin loaded via hook system',
              },
              init: async () => {
                // Default init implementation
              },
            },
            duration: 0,
          },
        });
      },
      { priority: 'lowest', mode: 'async' }
    );
  }

  /**
   * Execute hooks synchronously
   */
  private async _executeSyncHooks<T, R>(
    hooks: HookRegistration[],
    data: T,
    context: HookContext,
    timeout: number
  ): Promise<HookResult<R>[]> {
    const results: HookResult<R>[] = [];

    for (const hook of hooks) {
      if (context.isCancelled()) {
        break;
      }

      const result = await this._executeHook<T, R>(hook, data, context, timeout);
      results.push(result);

      if (!result.success && hook.config.cancellable) {
        context.cancel();
      }
    }

    return results;
  }

  /**
   * Execute hooks asynchronously (sequential)
   */
  private async _executeAsyncHooks<T, R>(
    hooks: HookRegistration[],
    data: T,
    context: HookContext,
    timeout: number
  ): Promise<HookResult<R>[]> {
    return this._executeSyncHooks<T, R>(hooks, data, context, timeout);
  }

  /**
   * Execute hooks in parallel
   */
  private async _executeParallelHooks<T, R>(
    hooks: HookRegistration[],
    data: T,
    context: HookContext,
    timeout: number
  ): Promise<HookResult<R>[]> {
    const promises = hooks.map(hook => this._executeHook<T, R>(hook, data, context, timeout));
    return Promise.all(promises);
  }

  /**
   * Execute a single hook
   */
  private async _executeHook<T, R>(
    hook: HookRegistration,
    data: T,
    context: HookContext,
    timeout: number
  ): Promise<HookResult<R>> {
    const startTime = Date.now();

    try {
      const promise = Promise.resolve(hook.handler(data, context));

      let result: unknown;
      if (timeout > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Hook timeout after ${timeout}ms`)), timeout);
        });
        result = await Promise.race([promise, timeoutPromise]);
      } else {
        result = await promise;
      }

      return {
        success: true,
        data: result as R,
        executionTime: Date.now() - startTime,
        hookId: hook.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        executionTime: Date.now() - startTime,
        hookId: hook.id,
      };
    }
  }

  /**
   * Create hook context
   */
  private _createHookContext(name: string, plugin: PluginId | undefined): HookContext {
    let cancelled = false;

    return {
      name,
      kernel: this._kernel,
      plugin,
      metadata: {
        timestamp: Date.now(),
        executionId: `exec-${Date.now()}-${Math.random()}`,
        phase: 'during',
      },
      cancel: (): void => {
        cancelled = true;
      },
      isCancelled: (): boolean => cancelled,
    };
  }

  /**
   * Compare hook priorities
   */
  private _comparePriority(a: HookPriority, b: HookPriority): number {
    const priorities: Record<HookPriority, number> = {
      highest: 5,
      high: 4,
      normal: 3,
      low: 2,
      lowest: 1,
    };

    return priorities[b] - priorities[a]; // Higher priority first
  }
}
