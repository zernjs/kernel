/**
 * @fileoverview EventBus implementation with wildcard support and error handling
 * @module @zern/kernel/events/event-bus
 */

import type {
  EventHandler,
  EventContext,
  EventPattern,
  EventListenerConfig,
  EventSubscriptionId,
  EventHandlerId,
  BaseEvent,
  EventMap,
  EventKeys,
  EventPriority,
  PluginId,
} from '../types';
import { createEventSubscriptionId, createEventHandlerId } from '../types';

/**
 * Event subscription internal structure
 */
interface EventSubscription {
  id: EventSubscriptionId;
  handlerId: EventHandlerId;
  pattern: EventPattern;
  handler: EventHandler;
  config: InternalEventConfig;
  plugin?: PluginId;
  active: boolean;
}

/**
 * Internal event configuration with additional properties
 */
interface InternalEventConfig {
  once: boolean;
  priority: EventPriority;
  async: boolean;
  timeout: number;
  plugin?: PluginId | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * EventBus implementation with wildcard support and error handling
 */
export class EventBus {
  private readonly _subscriptions = new Map<EventSubscriptionId, EventSubscription>();
  private readonly _patternSubscriptions = new Map<string, Set<EventSubscriptionId>>();
  private readonly _wildcardSubscriptions = new Set<EventSubscriptionId>();
  private readonly _errorHandlers = new Set<(error: Error, context?: EventContext) => void>();

  /**
   * Subscribe to events with pattern support
   */
  on<K extends EventKeys>(
    pattern: K | EventPattern,
    handler: EventHandler,
    config: Partial<EventListenerConfig> = {}
  ): EventSubscriptionId {
    const subscriptionId = createEventSubscriptionId(`sub-${Date.now()}-${Math.random()}`);
    const handlerId = createEventHandlerId(`handler-${Date.now()}-${Math.random()}`);

    const subscription: EventSubscription = {
      id: subscriptionId,
      handlerId,
      pattern: pattern as EventPattern,
      handler,
      config: {
        once: config.once || false,
        priority: config.priority || 'normal',
        async: true,
        timeout: 5000,
        plugin: config.plugin || undefined,
        metadata: config.metadata || undefined,
      },
      active: true,
    };

    this._subscriptions.set(subscriptionId, subscription);

    // Handle different pattern types
    if (typeof pattern === 'string') {
      if (this._isWildcardPattern(pattern)) {
        this._wildcardSubscriptions.add(subscriptionId);
      } else {
        if (!this._patternSubscriptions.has(pattern)) {
          this._patternSubscriptions.set(pattern, new Set());
        }
        this._patternSubscriptions.get(pattern)!.add(subscriptionId);
      }
    } else {
      // RegExp or function patterns are treated as wildcards
      this._wildcardSubscriptions.add(subscriptionId);
    }

    return subscriptionId;
  }

  /**
   * Subscribe to events once
   */
  once<K extends EventKeys>(
    pattern: K | EventPattern,
    handler: EventHandler,
    config: Partial<EventListenerConfig> = {}
  ): EventSubscriptionId {
    return this.on(pattern, handler, { ...config, once: true });
  }

  /**
   * Unsubscribe from events
   */
  off(subscriptionId: EventSubscriptionId): boolean {
    const subscription = this._subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    // Remove from pattern maps
    if (typeof subscription.pattern === 'string') {
      if (this._isWildcardPattern(subscription.pattern)) {
        this._wildcardSubscriptions.delete(subscriptionId);
      } else {
        const patternSubs = this._patternSubscriptions.get(subscription.pattern);
        if (patternSubs) {
          patternSubs.delete(subscriptionId);
          if (patternSubs.size === 0) {
            this._patternSubscriptions.delete(subscription.pattern);
          }
        }
      }
    } else {
      this._wildcardSubscriptions.delete(subscriptionId);
    }

    this._subscriptions.delete(subscriptionId);
    return true;
  }

  /**
   * Remove all listeners for a pattern
   */
  removeAllListeners(pattern?: EventPattern): void {
    if (!pattern) {
      // Remove all subscriptions
      this._subscriptions.clear();
      this._patternSubscriptions.clear();
      this._wildcardSubscriptions.clear();
      return;
    }

    const toRemove: EventSubscriptionId[] = [];

    for (const [id, subscription] of this._subscriptions) {
      if (this._matchesPattern(subscription.pattern, pattern)) {
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => this.off(id));
  }

  /**
   * Emit an event to all matching subscribers
   */
  async emit<K extends EventKeys>(eventType: K, event: EventMap[K]): Promise<boolean> {
    const matchingSubscriptions = this._getMatchingSubscriptions(eventType as EventPattern);

    if (matchingSubscriptions.length === 0) {
      return false;
    }

    // Sort by priority (higher priority first)
    const priorityOrder: Record<EventPriority, number> = {
      critical: 3,
      high: 2,
      normal: 1,
      low: 0,
    };
    matchingSubscriptions.sort(
      (a, b) => priorityOrder[b.config.priority] - priorityOrder[a.config.priority]
    );

    const context = this._createEventContext(event);
    const promises: Promise<void>[] = [];

    for (const subscription of matchingSubscriptions) {
      if (!subscription.active || context.isPropagationStopped()) {
        continue;
      }

      try {
        const handlerPromise = this._executeHandler(subscription, context);

        if (subscription.config.async) {
          promises.push(handlerPromise);
        } else {
          await handlerPromise;
        }

        // Remove once listeners
        if (subscription.config.once) {
          this.off(subscription.id);
        }

        if (context.isImmediatePropagationStopped()) {
          break;
        }
      } catch (error) {
        this._handleError(error as Error, context);
      }
    }

    // Wait for all async handlers and handle any errors
    if (promises.length > 0) {
      const results = await Promise.allSettled(promises);
      results.forEach(result => {
        if (result.status === 'rejected') {
          this._handleError(result.reason as Error, context);
        }
      });
    }

    return true;
  }

  /**
   * Get listener count for a pattern
   */
  listenerCount(pattern: EventPattern): number {
    return this._getMatchingSubscriptions(pattern).length;
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): EventSubscription[] {
    return Array.from(this._subscriptions.values()).filter(sub => sub.active);
  }

  /**
   * Add error handler
   */
  onError(handler: (error: Error, context?: EventContext) => void): void {
    this._errorHandlers.add(handler);
  }

  /**
   * Remove error handler
   */
  offError(handler: (error: Error, context?: EventContext) => void): void {
    this._errorHandlers.delete(handler);
  }

  /**
   * Check if pattern is a wildcard pattern
   */
  private _isWildcardPattern(pattern: string): boolean {
    return pattern.includes('*') || pattern.includes('?') || pattern.includes('[');
  }

  /**
   * Check if two patterns match
   */
  private _matchesPattern(subscriptionPattern: EventPattern, targetPattern: EventPattern): boolean {
    if (subscriptionPattern === targetPattern) {
      return true;
    }

    if (typeof subscriptionPattern === 'string' && typeof targetPattern === 'string') {
      return this._matchWildcard(subscriptionPattern, targetPattern);
    }

    return false;
  }

  /**
   * Get subscriptions matching an event type
   */
  private _getMatchingSubscriptions(eventType: EventPattern): EventSubscription[] {
    const matching: EventSubscription[] = [];

    // Exact matches
    if (typeof eventType === 'string') {
      const exactSubs = this._patternSubscriptions.get(eventType);
      if (exactSubs) {
        for (const id of exactSubs) {
          const sub = this._subscriptions.get(id);
          if (sub?.active) {
            matching.push(sub);
          }
        }
      }
    }

    // Wildcard matches
    for (const id of this._wildcardSubscriptions) {
      const sub = this._subscriptions.get(id);
      if (!sub?.active) continue;

      if (this._matchesEventType(sub.pattern, eventType)) {
        matching.push(sub);
      }
    }

    return matching;
  }

  /**
   * Check if a pattern matches an event type
   */
  private _matchesEventType(pattern: EventPattern, eventType: EventPattern): boolean {
    if (typeof pattern === 'string' && typeof eventType === 'string') {
      return this._matchWildcard(pattern, eventType);
    }

    if (pattern instanceof RegExp && typeof eventType === 'string') {
      return pattern.test(eventType);
    }

    if (typeof pattern === 'function' && typeof eventType === 'string') {
      return pattern(eventType);
    }

    return false;
  }

  /**
   * Match wildcard patterns
   */
  private _matchWildcard(pattern: string, text: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // * matches any characters
      .replace(/\?/g, '.'); // ? matches single character

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(text);
  }

  /**
   * Create event context
   */
  private _createEventContext(event: BaseEvent): EventContext {
    let propagationStopped = false;
    let immediatePropagationStopped = false;

    return {
      event,
      handler: {
        id: createEventHandlerId('context-handler'),
        priority: 'normal',
      },
      startTime: Date.now(),
      chain: [createEventHandlerId('context-handler')],
      stopPropagation: (): void => {
        propagationStopped = true;
      },
      stopImmediatePropagation: (): void => {
        propagationStopped = true;
        immediatePropagationStopped = true;
      },
      isPropagationStopped: (): boolean => propagationStopped,
      isImmediatePropagationStopped: (): boolean => immediatePropagationStopped,
    };
  }

  /**
   * Execute event handler with timeout and error handling
   */
  private async _executeHandler(
    subscription: EventSubscription,
    context: EventContext
  ): Promise<void> {
    const { handler, config } = subscription;
    const timeout = config.timeout || 5000;

    try {
      const handlerPromise = Promise.resolve(handler(context.event, context));

      if (timeout > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Handler timeout after ${timeout}ms`)), timeout);
        });

        await Promise.race([handlerPromise, timeoutPromise]);
      } else {
        await handlerPromise;
      }
    } catch (error) {
      this._handleError(error as Error, context);
    }
  }

  /**
   * Handle errors from event handlers
   */
  private _handleError(error: Error, context?: EventContext): void {
    if (this._errorHandlers.size === 0) {
      console.error('Unhandled event error:', error);
      return;
    }

    for (const handler of this._errorHandlers) {
      try {
        handler(error, context);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    }
  }
}
