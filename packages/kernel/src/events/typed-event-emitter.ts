/**
 * @fileoverview Typed EventEmitter with enhanced type safety and async handling
 * @module @zern/kernel/events/typed-event-emitter
 */

/// <reference types="node" />

import { EventBus } from './event-bus.js';
import type {
  EventMap,
  EventKeys,
  EventHandler,
  EventListenerConfig,
  EventSubscriptionId,
  EventContext,
  BaseEvent,
  EventPattern,
  KernelEventEmitter,
  EventPriority,
  Awaitable,
  PluginId,
} from '../types';

/**
 * Event listener function type
 */
export type EventListener<T extends BaseEvent> = (event: T) => Awaitable<void>;

/**
 * Event listener with metadata
 */
interface TypedEventListener<T extends BaseEvent> {
  listener: EventListener<T>;
  subscriptionId?: EventSubscriptionId;
  config: EventListenerConfig;
  plugin?: PluginId;
}

/**
 * Typed EventEmitter implementation with enhanced type safety
 */
export class TypedEventEmitter implements KernelEventEmitter {
  private readonly _eventBus: EventBus;
  private readonly _listeners = new Map<EventKeys, Set<TypedEventListener<BaseEvent>>>();
  private readonly _onceListeners = new Map<EventKeys, Set<TypedEventListener<BaseEvent>>>();
  private readonly _customErrorHandlers = new Set<
    (error: Error, eventType: string, eventData: unknown) => void
  >();

  constructor() {
    this._eventBus = new EventBus();
    this._setupErrorHandling();
  }

  /**
   * Add event listener with type safety
   */
  on<K extends EventKeys>(
    event: K,
    listener: EventListener<EventMap[K]>,
    config: Partial<EventListenerConfig> = {}
  ): this {
    const typedListener: TypedEventListener<EventMap[K]> = {
      listener,
      config: {
        handler: () => Promise.resolve(), // Placeholder, will be set below
        once: false,
        priority: 'normal' as EventPriority,
        ...config,
      },
    };

    // Create the actual handler
    const eventHandler = this._createEventHandler(typedListener);
    typedListener.config.handler = eventHandler;

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(typedListener);

    // Register with EventBus using the simplified config
    const busConfig: Partial<EventListenerConfig> = {};
    if (typedListener.config.once !== undefined) {
      busConfig.once = typedListener.config.once;
    }
    if (typedListener.config.priority !== undefined) {
      busConfig.priority = typedListener.config.priority;
    }
    if (typedListener.config.plugin !== undefined) {
      busConfig.plugin = typedListener.config.plugin;
    }
    if (typedListener.config.metadata !== undefined) {
      busConfig.metadata = typedListener.config.metadata;
    }
    const subscriptionId = this._eventBus.on(event, eventHandler, busConfig);
    typedListener.subscriptionId = subscriptionId;

    return this;
  }

  /**
   * Add one-time event listener
   */
  once<K extends EventKeys>(
    event: K,
    listener: EventListener<EventMap[K]>,
    config: Partial<EventListenerConfig> = {}
  ): this {
    const typedListener: TypedEventListener<EventMap[K]> = {
      listener,
      config: {
        handler: () => Promise.resolve(), // Placeholder, will be set below
        once: true,
        priority: 'normal' as EventPriority,
        ...config,
      },
    };

    // Create the actual handler
    const eventHandler = this._createEventHandler(typedListener);
    typedListener.config.handler = eventHandler;

    if (!this._onceListeners.has(event)) {
      this._onceListeners.set(event, new Set());
    }
    this._onceListeners.get(event)!.add(typedListener);

    // Register with EventBus using the simplified config
    const busConfig: Partial<EventListenerConfig> = {};
    if (typedListener.config.once !== undefined) {
      busConfig.once = typedListener.config.once;
    }
    if (typedListener.config.priority !== undefined) {
      busConfig.priority = typedListener.config.priority;
    }
    if (typedListener.config.plugin !== undefined) {
      busConfig.plugin = typedListener.config.plugin;
    }
    if (typedListener.config.metadata !== undefined) {
      busConfig.metadata = typedListener.config.metadata;
    }
    const subscriptionId = this._eventBus.once(event, eventHandler, busConfig);
    typedListener.subscriptionId = subscriptionId;

    return this;
  }

  /**
   * Remove event listener
   */
  off<K extends EventKeys>(event: K, listener: EventListener<EventMap[K]>): this {
    // Remove from regular listeners
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const typedListener of listeners) {
        if (typedListener.listener === listener) {
          // Remove from EventBus using the subscription ID
          if (typedListener.subscriptionId) {
            this._eventBus.off(typedListener.subscriptionId);
          }
          listeners.delete(typedListener);
          break;
        }
      }
      if (listeners.size === 0) {
        this._listeners.delete(event);
      }
    }

    // Remove from once listeners
    const onceListeners = this._onceListeners.get(event);
    if (onceListeners) {
      for (const typedListener of onceListeners) {
        if (typedListener.listener === listener) {
          // Remove from EventBus using the subscription ID
          if (typedListener.subscriptionId) {
            this._eventBus.off(typedListener.subscriptionId);
          }
          onceListeners.delete(typedListener);
          break;
        }
      }
      if (onceListeners.size === 0) {
        this._onceListeners.delete(event);
      }
    }

    return this;
  }

  /**
   * Emit event with type safety (synchronous)
   */
  emit<K extends EventKeys>(event: K, data: EventMap[K]): boolean {
    let hasErrors = false;

    // Set up temporary error handler to track errors
    const errorHandler = (error: Error, _context?: EventContext): void => {
      hasErrors = true;
      // Call custom error handlers with the expected signature
      this._customErrorHandlers.forEach(handler => {
        try {
          handler(error, event as string, data);
        } catch (handlerError) {
          console.error('Error in custom error handler:', handlerError);
        }
      });
    };

    this._eventBus.onError(errorHandler);

    try {
      // Execute local listeners first
      const listeners = this._listeners.get(event) || new Set();
      const onceListeners = this._onceListeners.get(event) || new Set();

      // Execute regular listeners
      for (const typedListener of listeners) {
        try {
          const result = typedListener.listener(data);
          // If it's a promise, we can't wait for it in sync mode
          if (result && typeof result === 'object' && 'then' in result) {
            result.catch((error: Error) => {
              this._customErrorHandlers.forEach(handler => {
                try {
                  handler(error, event as string, data);
                } catch (handlerError) {
                  console.error('Error in custom error handler:', handlerError);
                }
              });
            });
          }
        } catch (error) {
          hasErrors = true;
          this._customErrorHandlers.forEach(handler => {
            try {
              handler(error as Error, event as string, data);
            } catch (handlerError) {
              console.error('Error in custom error handler:', handlerError);
            }
          });
        }
      }

      // Execute once listeners and collect them for removal
      const executedOnceListeners = new Set<TypedEventListener<EventMap[K]>>();
      for (const typedListener of onceListeners) {
        try {
          const result = typedListener.listener(data);
          executedOnceListeners.add(typedListener);
          // If it's a promise, we can't wait for it in sync mode
          if (result && typeof result === 'object' && 'then' in result) {
            result.catch((error: Error) => {
              this._customErrorHandlers.forEach(handler => {
                try {
                  handler(error, event as string, data);
                } catch (handlerError) {
                  console.error('Error in custom error handler:', handlerError);
                }
              });
            });
          }
        } catch (error) {
          hasErrors = true;
          executedOnceListeners.add(typedListener);
          this._customErrorHandlers.forEach(handler => {
            try {
              handler(error as Error, event as string, data);
            } catch (handlerError) {
              console.error('Error in custom error handler:', handlerError);
            }
          });
        }
      }

      // Remove only the executed once listeners
      if (executedOnceListeners.size > 0) {
        const remainingOnceListeners = this._onceListeners.get(event);
        if (remainingOnceListeners) {
          for (const executedListener of executedOnceListeners) {
            remainingOnceListeners.delete(executedListener);
            // Also remove from EventBus
            if (executedListener.subscriptionId) {
              this._eventBus.off(executedListener.subscriptionId);
            }
          }
          // If no more once listeners for this event, remove the set
          if (remainingOnceListeners.size === 0) {
            this._onceListeners.delete(event);
          }
        }
      }

      // Only emit through EventBus for pattern listeners if we don't have direct listeners
      // This prevents duplicate execution of the same listeners
      const hasDirectListeners = listeners.size > 0 || onceListeners.size > 0;
      if (!hasDirectListeners) {
        this._eventBus.emit(event, data).catch((error: Error) => {
          this._customErrorHandlers.forEach(handler => {
            try {
              handler(error, event as string, data);
            } catch (handlerError) {
              console.error('Error in custom error handler:', handlerError);
            }
          });
        });
      }

      // Return true if we had any listeners (local or EventBus) and no errors
      const hasListeners = listeners.size > 0 || onceListeners.size > 0;
      return hasListeners && !hasErrors;
    } finally {
      this._eventBus.offError(errorHandler);
    }
  }

  /**
   * Emit event asynchronously
   */
  async emitAsync<K extends EventKeys>(event: K, data: EventMap[K]): Promise<boolean> {
    try {
      let hasErrors = false;

      // Set up temporary error handler to track errors
      const errorHandler = (error: Error, _context?: EventContext): void => {
        hasErrors = true;
        // Call custom error handlers with the expected signature
        this._customErrorHandlers.forEach(handler => {
          try {
            handler(error, event as string, data);
          } catch (handlerError) {
            console.error('Error in custom error handler:', handlerError);
          }
        });
      };

      this._eventBus.onError(errorHandler);

      try {
        await this._eventBus.emit(event, data);
        return !hasErrors;
      } finally {
        this._eventBus.offError(errorHandler);
      }
    } catch (error) {
      console.error(`Error emitting event ${event}:`, error);
      return false;
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends EventKeys>(event?: K): this {
    if (event) {
      this._listeners.delete(event);
      this._onceListeners.delete(event);
      this._eventBus.removeAllListeners(event as EventPattern);
    } else {
      this._listeners.clear();
      this._onceListeners.clear();
      this._eventBus.removeAllListeners();
    }
    return this;
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends EventKeys>(event: K): number {
    const regularCount = this._listeners.get(event)?.size || 0;
    const onceCount = this._onceListeners.get(event)?.size || 0;
    return regularCount + onceCount;
  }

  /**
   * Get all listeners for an event
   */
  listeners<K extends EventKeys>(event: K): EventListener<EventMap[K]>[] {
    const result: EventListener<EventMap[K]>[] = [];

    const regularListeners = this._listeners.get(event);
    if (regularListeners) {
      for (const typedListener of regularListeners) {
        result.push(typedListener.listener);
      }
    }

    const onceListeners = this._onceListeners.get(event);
    if (onceListeners) {
      for (const typedListener of onceListeners) {
        result.push(typedListener.listener);
      }
    }

    return result;
  }

  /**
   * Get raw event names
   */
  eventNames(): EventKeys[] {
    const names = new Set<EventKeys>();

    for (const event of this._listeners.keys()) {
      names.add(event);
    }

    for (const event of this._onceListeners.keys()) {
      names.add(event);
    }

    return Array.from(names);
  }

  /**
   * Add listener with pattern support (wildcard, regex, function)
   */
  onPattern(
    pattern: EventPattern,
    handler: EventHandler,
    config: Partial<EventListenerConfig> = {}
  ): EventSubscriptionId {
    return this._eventBus.on(pattern, handler, config);
  }

  /**
   * Add one-time listener with pattern support
   */
  oncePattern(
    pattern: EventPattern,
    handler: EventHandler,
    config: Partial<EventListenerConfig> = {}
  ): EventSubscriptionId {
    return this._eventBus.once(pattern, handler, config);
  }

  /**
   * Remove pattern listener
   */
  offPattern(subscriptionId: EventSubscriptionId): boolean {
    return this._eventBus.off(subscriptionId);
  }

  /**
   * Wait for an event to be emitted
   */
  waitFor<K extends EventKeys>(
    event: K,
    timeout?: number,
    filter?: (data: EventMap[K]) => boolean
  ): Promise<EventMap[K]> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line no-undef
      let timeoutId: NodeJS.Timeout | undefined;

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      const listener = (data: EventMap[K]): void => {
        if (filter && !filter(data)) {
          return;
        }

        cleanup();
        this.off(event, listener);
        resolve(data);
      };

      this.once(event, listener);

      if (timeout && timeout > 0) {
        timeoutId = setTimeout(() => {
          this.off(event, listener);
          reject(new Error(`Timeout waiting for event ${event} after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * Create a promise that resolves when multiple events are emitted
   */
  waitForAll<K extends EventKeys>(events: K[], timeout?: number): Promise<Record<K, EventMap[K]>> {
    return new Promise((resolve, reject) => {
      const results: Partial<Record<K, EventMap[K]>> = {};
      let completed = 0;
      // eslint-disable-next-line no-undef
      let timeoutId: NodeJS.Timeout | undefined;
      const listeners = new Map<K, (data: EventMap[K]) => void>();

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        // Remove only the specific listeners we created
        listeners.forEach((listener, event) => {
          this.off(event, listener);
        });
        listeners.clear();
      };

      const checkCompletion = (): void => {
        if (completed === events.length) {
          cleanup();
          resolve(results as Record<K, EventMap[K]>);
        }
      };

      events.forEach((event: K): void => {
        const listener = (data: EventMap[K]): void => {
          results[event] = data;
          completed++;
          checkCompletion();
        };

        listeners.set(event, listener);
        this.once(event, listener);
      });

      if (timeout && timeout > 0) {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Timeout waiting for events ${events.join(', ')} after ${timeout}ms`));
        }, timeout);
      }
    });
  }

  /**
   * Get event bus instance for advanced operations
   */
  getEventBus(): EventBus {
    return this._eventBus;
  }

  /**
   * Add error handler
   */
  onError(handler: (error: Error, eventType: string, eventData: unknown) => void): void {
    this._customErrorHandlers.add(handler);
  }

  /**
   * Remove error handler
   */
  offError(handler: (error: Error, eventType: string, eventData: unknown) => void): boolean {
    return this._customErrorHandlers.delete(handler);
  }

  /**
   * Create event handler wrapper for EventBus
   */
  private _createEventHandler<T extends BaseEvent>(
    typedListener: TypedEventListener<T>
  ): EventHandler {
    return async (event: BaseEvent, _context: EventContext): Promise<void> => {
      try {
        await typedListener.listener(event as T);
      } catch (error) {
        console.error('Error in typed event listener:', error);
        throw error;
      }
    };
  }

  /**
   * Setup error handling for the event bus
   */
  private _setupErrorHandling(): void {
    this._eventBus.onError((error: Error, context?: EventContext) => {
      console.error('EventBus error:', error);
      if (context) {
        console.error('Event context:', {
          eventType: context.event.type,
          eventId: context.event.id,
          timestamp: context.event.timestamp,
        });
      }
    });
  }
}
