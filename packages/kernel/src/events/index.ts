/**
 * @fileoverview Event system exports
 * @module @zern/kernel/events
 */

// Core event system
export { EventBus } from './event-bus.js';
export { TypedEventEmitter } from './typed-event-emitter.js';
export type { EventListener } from './typed-event-emitter.js';

// Hook system
export { HookSystem } from './hook-system.js';
export type {
  HookPriority,
  HookMode,
  HookConfig,
  HookHandler,
  HookContext,
  HookResult,
  HookRegistration,
} from './hook-system.js';

// Import EventContext for local use
import type { EventContext } from '../types';

// Re-export event types for convenience
export type {
  EventHandler,
  EventContext,
  EventPattern,
  EventListenerConfig,
  EventSubscriptionId,
  EventHandlerId,
  BaseEvent,
  EventMap,
  EventKeys,
  KernelEventEmitter,
  EventSubscription,
  EventPriority,
} from '../types';

// Error handler type (commonly used pattern)
export type ErrorHandler = (error: Error, context?: EventContext) => void;
