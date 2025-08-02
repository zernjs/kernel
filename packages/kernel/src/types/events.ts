/**
 * @fileoverview Event system types and interfaces
 * @module @zern/kernel/types/events
 */

import type { Plugin, PluginState } from './plugin.js';
import type { KernelState, KernelInfo, KernelMetrics } from './kernel.js';
import type {
  Branded,
  StringLiteral,
  Prettify,
  Optional,
  RequireAtLeastOne,
  Awaitable,
  NonEmptyArray,
  DeepReadonly,
  EventId,
  PluginId,
  Mutable,
  AnyFunction,
  ValuesOfType,
  Result,
  ValidationError,
} from './utils.js';

// Import runtime utilities separately
import { isObject, isString, isNumber, isNotNullish } from './utils.js';

/**
 * Branded types for events
 */
export type EventType = Branded<string, 'EventType'>;
export type EventSource = Branded<string, 'EventSource'>;
export type EventSubscriptionId = Branded<string, 'EventSubscriptionId'>;
export type EventHandlerId = Branded<string, 'EventHandlerId'>;

/**
 * Base event interface
 */
export interface BaseEvent {
  /** Event type */
  type: string;
  /** Event timestamp */
  timestamp: number;
  /** Event source */
  source: EventSource;
  /** Event ID */
  id: EventId;
  /** Event metadata */
  metadata?: DeepReadonly<Record<string, unknown>>;
}

/**
 * Event priority levels
 */
export type EventPriority = StringLiteral<'low' | 'normal' | 'high' | 'critical'>;

/**
 * Event propagation control
 */
export interface EventPropagation {
  /** Stop event propagation */
  stopPropagation(): void;
  /** Stop immediate propagation */
  stopImmediatePropagation(): void;
  /** Check if propagation was stopped */
  isPropagationStopped(): boolean;
  /** Check if immediate propagation was stopped */
  isImmediatePropagationStopped(): boolean;
}

/**
 * Event context for handlers
 */
export interface EventContext extends EventPropagation {
  /** Event being processed */
  event: BaseEvent;
  /** Event handler metadata */
  handler: Prettify<{
    id: EventHandlerId;
    plugin?: PluginId;
    priority: EventPriority;
  }>;
  /** Processing start time */
  startTime: number;
  /** Event processing chain */
  chain: NonEmptyArray<EventHandlerId>;
}

/**
 * Event handler function
 */
export type EventHandler<T extends BaseEvent = BaseEvent> = (
  event: T,
  context: EventContext
) => Awaitable<void>;

/**
 * Event listener configuration with enhanced typing
 */
export type EventListenerConfig = Prettify<{
  /** Handler function */
  handler: EventHandler;
  /** Event priority */
  priority?: EventPriority;
  /** Whether to handle event only once */
  once?: boolean;
  /** Plugin that registered this listener */
  plugin?: PluginId;
  /** Listener metadata */
  metadata?: DeepReadonly<Record<string, unknown>>;
}>;

/**
 * Event emitter options with enhanced typing
 */
export type EventEmitOptions = Prettify<{
  /** Event priority */
  priority?: EventPriority;
  /** Whether to wait for async handlers */
  await?: boolean;
  /** Timeout for async handlers (ms) */
  timeout?: number;
  /** Whether to continue on handler errors */
  continueOnError?: boolean;
  /** Event metadata */
  metadata?: DeepReadonly<Record<string, unknown>>;
}>;

/**
 * Kernel lifecycle events
 */
export type KernelLifecycleEvents = Prettify<{
  'kernel:initializing': KernelInitializingEvent;
  'kernel:initialized': KernelInitializedEvent;
  'kernel:loading': KernelLoadingEvent;
  'kernel:ready': KernelReadyEvent;
  'kernel:starting': KernelStartingEvent;
  'kernel:started': KernelStartedEvent;
  'kernel:stopping': KernelStoppingEvent;
  'kernel:stopped': KernelStoppedEvent;
  'kernel:shutdown': KernelShutdownEvent;
  'kernel:error': KernelErrorEvent;
  'kernel:state-changed': KernelStateChangedEvent;
}>;

/**
 * Plugin lifecycle events
 */
export type PluginLifecycleEvents = Prettify<{
  'plugin:discovered': PluginDiscoveredEvent;
  'plugin:loading': PluginLoadingEvent;
  'plugin:loaded': PluginLoadedEvent;
  'plugin:initializing': PluginInitializingEvent;
  'plugin:initialized': PluginInitializedEvent;
  'plugin:starting': PluginStartingEvent;
  'plugin:started': PluginStartedEvent;
  'plugin:stopping': PluginStoppingEvent;
  'plugin:stopped': PluginStoppedEvent;
  'plugin:unloading': PluginUnloadingEvent;
  'plugin:unloaded': PluginUnloadedEvent;
  'plugin:error': PluginErrorEvent;
  'plugin:state-changed': PluginStateChangedEvent;
  'plugin:dependency-resolved': PluginDependencyResolvedEvent;
  'plugin:health-check': PluginHealthCheckEvent;
}>;

/**
 * System events
 */
export type SystemEvents = Prettify<{
  'system:performance': SystemPerformanceEvent;
  'system:memory-warning': SystemMemoryWarningEvent;
  'system:cpu-warning': SystemCpuWarningEvent;
  'system:error': SystemErrorEvent;
  'system:metrics': SystemMetricsEvent;
  'system:config-changed': SystemConfigChangedEvent;
  'system:hot-reload': SystemHotReloadEvent;
}>;

/**
 * Development events
 */
export type DevelopmentEvents = Prettify<{
  'dev:file-changed': DevFileChangedEvent;
  'dev:plugin-reloaded': DevPluginReloadedEvent;
  'dev:debug': DevDebugEvent;
  'dev:profiler': DevProfilerEvent;
}>;

/**
 * Complete event map with enhanced typing
 */
export type EventMap = Prettify<
  KernelLifecycleEvents &
    PluginLifecycleEvents &
    SystemEvents &
    DevelopmentEvents & {
      // Allow custom events
      [key: string]: BaseEvent;
    }
>;

/**
 * Event factory functions with branded types
 */
export const createEventType = (type: string): EventType => type as EventType;
export const createEventSource = (source: string): EventSource => source as EventSource;
export const createEventSubscriptionId = (id: string): EventSubscriptionId =>
  id as EventSubscriptionId;
export const createEventHandlerId = (id: string): EventHandlerId => id as EventHandlerId;

/**
 * Enhanced event utility types
 */
export type EventKeys = keyof EventMap;
export type EventValues = ValuesOfType<EventMap, BaseEvent>;
export type EventTypeFromKey<K extends EventKeys> = EventMap[K]['type'];

/**
 * Event listener registry with enhanced typing
 */
export type EventListenerRegistry = Prettify<{
  [K in EventKeys]?: NonEmptyArray<EventListenerConfig>;
}>;

/**
 * Event subscription management with enhanced typing
 */
export type EventSubscriptionType = Prettify<{
  id: EventSubscriptionId;
  eventType: EventKeys;
  handler: EventHandler;
  config: EventListenerConfig;
  active: boolean;
}>;

/**
 * Event emitter interface with enhanced utility types
 */
export type EventEmitterMethods = Prettify<{
  on<K extends EventKeys>(
    eventType: K,
    handler: EventHandler<EventMap[K]>,
    config?: Optional<EventListenerConfig, 'handler'>
  ): EventSubscriptionId;
  off(subscriptionId: EventSubscriptionId): boolean;
  emit<K extends EventKeys>(
    eventType: K,
    event: EventMap[K],
    options?: EventEmitOptions
  ): Awaitable<void>;
  once<K extends EventKeys>(
    eventType: K,
    handler: EventHandler<EventMap[K]>,
    config?: Optional<EventListenerConfig, 'handler'>
  ): EventSubscriptionId;
  removeAllListeners(eventType?: EventKeys): void;
  listenerCount(eventType: EventKeys): number;
  getActiveSubscriptions(): DeepReadonly<EventSubscriptionType[]>;
}>;

// Kernel Events
export interface KernelInitializingEvent extends BaseEvent {
  type: StringLiteral<'kernel:initializing'>;
  data: {
    config: unknown; // KernelConfig
  };
}

export interface KernelInitializedEvent extends BaseEvent {
  type: StringLiteral<'kernel:initialized'>;
  data: {
    info: KernelInfo;
    duration: number;
  };
}

export interface KernelLoadingEvent extends BaseEvent {
  type: StringLiteral<'kernel:loading'>;
  data: {
    pluginCount: number;
    plugins: string[];
  };
}

export interface KernelReadyEvent extends BaseEvent {
  type: StringLiteral<'kernel:ready'>;
  data: {
    info: KernelInfo;
    loadedPlugins: string[];
    duration: number;
  };
}

export interface KernelStartingEvent extends BaseEvent {
  type: StringLiteral<'kernel:starting'>;
  data: {
    pluginCount: number;
  };
}

export interface KernelStartedEvent extends BaseEvent {
  type: StringLiteral<'kernel:started'>;
  data: {
    info: KernelInfo;
    startedPlugins: string[];
    duration: number;
  };
}

export interface KernelStoppingEvent extends BaseEvent {
  type: StringLiteral<'kernel:stopping'>;
  data: {
    reason?: string;
    force?: boolean;
  };
}

export interface KernelStoppedEvent extends BaseEvent {
  type: StringLiteral<'kernel:stopped'>;
  data: {
    duration: number;
    stoppedPlugins: string[];
  };
}

export interface KernelShutdownEvent extends BaseEvent {
  type: StringLiteral<'kernel:shutdown'>;
  data: {
    reason?: string;
    exitCode?: number;
  };
}

export interface KernelErrorEvent extends BaseEvent {
  type: StringLiteral<'kernel:error'>;
  data: RequireAtLeastOne<
    {
      error: DeepReadonly<Error>;
      context?: string;
      recoverable: boolean;
    },
    'error'
  >;
}

export interface KernelStateChangedEvent extends BaseEvent {
  type: StringLiteral<'kernel:state-changed'>;
  data: {
    previousState: KernelState;
    currentState: KernelState;
    reason?: string;
  };
}

// Plugin Events
export interface PluginDiscoveredEvent extends BaseEvent {
  type: StringLiteral<'plugin:discovered'>;
  data: {
    pluginId: string;
    path: string;
    metadata?: Record<string, unknown>;
  };
}

export interface PluginLoadingEvent extends BaseEvent {
  type: StringLiteral<'plugin:loading'>;
  data: {
    pluginId: string;
    path?: string;
  };
}

export interface PluginLoadedEvent extends BaseEvent {
  type: StringLiteral<'plugin:loaded'>;
  data: {
    plugin: Plugin;
    duration: number;
  };
}

export interface PluginInitializingEvent extends BaseEvent {
  type: StringLiteral<'plugin:initializing'>;
  data: {
    pluginId: string;
    config?: unknown;
  };
}

export interface PluginInitializedEvent extends BaseEvent {
  type: StringLiteral<'plugin:initialized'>;
  data: {
    pluginId: string;
    duration: number;
  };
}

export interface PluginStartingEvent extends BaseEvent {
  type: StringLiteral<'plugin:starting'>;
  data: {
    pluginId: string;
  };
}

export interface PluginStartedEvent extends BaseEvent {
  type: StringLiteral<'plugin:started'>;
  data: {
    pluginId: string;
    duration: number;
  };
}

export interface PluginStoppingEvent extends BaseEvent {
  type: StringLiteral<'plugin:stopping'>;
  data: {
    pluginId: string;
    reason?: string;
  };
}

export interface PluginStoppedEvent extends BaseEvent {
  type: StringLiteral<'plugin:stopped'>;
  data: {
    pluginId: string;
    duration: number;
  };
}

export interface PluginUnloadingEvent extends BaseEvent {
  type: StringLiteral<'plugin:unloading'>;
  data: {
    pluginId: string;
  };
}

export interface PluginUnloadedEvent extends BaseEvent {
  type: StringLiteral<'plugin:unloaded'>;
  data: {
    pluginId: string;
    duration: number;
  };
}

export interface PluginErrorEvent extends BaseEvent {
  type: StringLiteral<'plugin:error'>;
  data: RequireAtLeastOne<
    {
      pluginId: string;
      error: DeepReadonly<Error>;
      context?: string;
      recoverable: boolean;
    },
    'pluginId' | 'error'
  >;
}

export interface PluginStateChangedEvent extends BaseEvent {
  type: StringLiteral<'plugin:state-changed'>;
  data: {
    pluginId: string;
    previousState: PluginState;
    currentState: PluginState;
    reason?: string;
  };
}

export interface PluginDependencyResolvedEvent extends BaseEvent {
  type: StringLiteral<'plugin:dependency-resolved'>;
  data: {
    pluginId: string;
    dependencyId: string;
    version: string;
  };
}

export interface PluginHealthCheckEvent extends BaseEvent {
  type: StringLiteral<'plugin:health-check'>;
  data: {
    pluginId: string;
    healthy: boolean;
    metrics?: Record<string, unknown>;
    issues?: string[];
  };
}

// System Events
export interface SystemPerformanceEvent extends BaseEvent {
  type: StringLiteral<'system:performance'>;
  data: {
    metrics: KernelMetrics;
    warnings?: string[];
  };
}

export interface SystemMemoryWarningEvent extends BaseEvent {
  type: StringLiteral<'system:memory-warning'>;
  data: {
    usage: number;
    limit: number;
    percentage: number;
    pluginUsage?: Record<string, number>;
  };
}

export interface SystemCpuWarningEvent extends BaseEvent {
  type: StringLiteral<'system:cpu-warning'>;
  data: {
    usage: number;
    threshold: number;
    duration: number;
  };
}

export interface SystemErrorEvent extends BaseEvent {
  type: StringLiteral<'system:error'>;
  data: RequireAtLeastOne<
    {
      error: DeepReadonly<Error>;
      component: string;
      severity: StringLiteral<'low' | 'medium' | 'high' | 'critical'>;
    },
    'error' | 'component'
  >;
}

export interface SystemMetricsEvent extends BaseEvent {
  type: StringLiteral<'system:metrics'>;
  data: {
    metrics: KernelMetrics;
    interval: number;
  };
}

export interface SystemConfigChangedEvent extends BaseEvent {
  type: StringLiteral<'system:config-changed'>;
  data: {
    path: string;
    changes: Record<string, unknown>;
    source: StringLiteral<'file' | 'api' | 'env'>;
  };
}

export interface SystemHotReloadEvent extends BaseEvent {
  type: StringLiteral<'system:hot-reload'>;
  data: {
    files: string[];
    affectedPlugins: string[];
  };
}

// Development Events
export interface DevFileChangedEvent extends BaseEvent {
  type: StringLiteral<'dev:file-changed'>;
  data: {
    path: string;
    event: StringLiteral<'add' | 'change' | 'unlink'>;
    stats?: {
      size: number;
      mtime: number;
    };
  };
}

export interface DevPluginReloadedEvent extends BaseEvent {
  type: StringLiteral<'dev:plugin-reloaded'>;
  data: {
    pluginId: string;
    reason: string;
    duration: number;
  };
}

export interface DevDebugEvent extends BaseEvent {
  type: StringLiteral<'dev:debug'>;
  data: {
    level: StringLiteral<'trace' | 'debug' | 'info' | 'warn' | 'error'>;
    message: string;
    context?: Record<string, unknown>;
  };
}

export interface DevProfilerEvent extends BaseEvent {
  type: StringLiteral<'dev:profiler'>;
  data: {
    operation: string;
    duration: number;
    memory?: number;
    cpu?: number;
    metadata?: Record<string, unknown>;
  };
}

/**
 * Event filter function with enhanced typing
 */
export type EventFilter<T extends BaseEvent = BaseEvent> = (event: T) => boolean;

/**
 * Event transformer function with enhanced typing
 */
export type EventTransformer<T extends BaseEvent = BaseEvent, R extends BaseEvent = BaseEvent> = (
  event: T
) => R;

/**
 * Event middleware function with enhanced typing
 */
export type EventMiddleware = (
  event: BaseEvent,
  context: EventContext,
  next: AnyFunction
) => Awaitable<void>;

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Subscription ID */
  id: EventSubscriptionId;
  /** Event type pattern */
  pattern: string | RegExp;
  /** Event handler */
  handler: EventHandler;
  /** Subscription options */
  options: EventListenerConfig;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Enhanced type guards with utility functions
 */
export function isEvent(obj: unknown): obj is BaseEvent {
  if (!isObject(obj) || !isNotNullish(obj)) return false;

  const event = obj as Record<string, unknown>;
  return (
    'type' in event &&
    'timestamp' in event &&
    'source' in event &&
    'id' in event &&
    isString(event.type) &&
    isNumber(event.timestamp) &&
    isString(event.source) &&
    isString(event.id)
  );
}

/**
 * Type guard to check if object is event context
 */
export function isEventContext(obj: unknown): obj is EventContext {
  if (!isObject(obj) || !isNotNullish(obj)) return false;

  const context = obj as Record<string, unknown>;
  return (
    'event' in context &&
    'handler' in context &&
    'startTime' in context &&
    isEvent(context.event) &&
    isObject(context.handler) &&
    isNumber(context.startTime)
  );
}

/**
 * Type guard for specific event types
 */
export function isEventOfType<K extends EventKeys>(
  event: BaseEvent,
  type: K
): event is EventMap[K] {
  return event.type === type;
}

/**
 * Type guard for events with data
 */
export function hasEventData<T extends BaseEvent>(
  event: T
): event is T & { data: NonNullable<T extends { data: infer D } ? D : never> } {
  return 'data' in event && isNotNullish((event as Record<string, unknown>).data);
}

/**
 * Utility to extract event type from event object
 */
export function getEventType<T extends BaseEvent>(event: T): T['type'] {
  return event.type;
}

/**
 * Type helpers for event system with enhanced typing
 */
export type EventTypeKey<T extends keyof EventMap> = T;
export type EventData<T extends keyof EventMap> = EventMap[T];
export type EventHandlerFor<T extends keyof EventMap> = EventHandler<EventMap[T]>;

/**
 * Utility type to extract event names
 */
export type EventNames = keyof EventMap;

/**
 * Utility type to check if event type exists
 */
export type IsValidEventType<T extends string> = T extends EventNames ? true : false;

/**
 * Event statistics with improved typing
 */
export interface EventStatistics {
  /** Total events emitted */
  totalEmitted: number;
  /** Total events handled */
  totalHandled: number;
  /** Total handler errors */
  totalErrors: number;
  /** Average processing time (ms) */
  avgProcessingTime: number;
  /** Events per second */
  eventsPerSecond: number;
  /** Event type statistics */
  byType: DeepReadonly<
    Record<
      string,
      Prettify<{
        count: number;
        avgProcessingTime: number;
        errorCount: number;
      }>
    >
  >;
  /** Plugin statistics */
  byPlugin: DeepReadonly<
    Record<
      string,
      Prettify<{
        emitted: number;
        handled: number;
        errors: number;
      }>
    >
  >;
}

/**
 * Enhanced event validation types
 */
export type EventValidationResult<T extends BaseEvent = BaseEvent> = Result<T, ValidationError[]>;

/**
 * Event metadata utilities
 */
export type EventMetadataKeys<T extends BaseEvent> = T extends { metadata: infer M }
  ? M extends Record<string, unknown>
    ? keyof M
    : never
  : never;

export type EventMetadataValue<T extends BaseEvent, K extends EventMetadataKeys<T>> = T extends {
  metadata: infer M;
}
  ? M extends Record<string, unknown>
    ? M[K]
    : never
  : never;

/**
 * Event data extraction utilities
 */
export type EventDataKeys<T extends BaseEvent> = T extends { data: infer D }
  ? D extends Record<string, unknown>
    ? keyof D
    : never
  : never;

export type EventDataValue<T extends BaseEvent, K extends EventDataKeys<T>> = T extends {
  data: infer D;
}
  ? D extends Record<string, unknown>
    ? D[K]
    : never
  : never;

/**
 * Event filtering utilities with enhanced typing
 */
export type EventsWithData<T extends Record<string, BaseEvent>> = {
  [K in keyof T]: T[K] extends { data: unknown } ? K : never;
}[keyof T];

export type EventsWithoutData<T extends Record<string, BaseEvent>> = {
  [K in keyof T]: T[K] extends { data: unknown } ? never : K;
}[keyof T];

export type EventsOfType<T extends Record<string, BaseEvent>, U> = {
  [K in keyof T]: T[K] extends { type: U } ? K : never;
}[keyof T];

/**
 * Mutable event for internal processing
 */
export type MutableEvent<T extends BaseEvent> = Mutable<T>;

/**
 * Event creation utilities with enhanced typing
 */
export type EventCreationData<T extends BaseEvent> = Omit<T, 'id' | 'timestamp' | 'source'>;

export type EventFactory<T extends BaseEvent> = (data: EventCreationData<T>) => T;

/**
 * Event batch processing utilities
 */
export type EventBatch<T extends BaseEvent = BaseEvent> = NonEmptyArray<T>;

export type EventBatchProcessor<T extends BaseEvent = BaseEvent> = (
  batch: EventBatch<T>
) => Awaitable<void>;

/**
 * Event aggregation utilities
 */
export type EventAggregator<T extends BaseEvent = BaseEvent, R = unknown> = (
  events: NonEmptyArray<T>
) => R;

/**
 * Event pattern matching utilities
 */
export type EventPattern = string | RegExp | ((eventType: string) => boolean);

export type EventMatcher = (event: BaseEvent, pattern: EventPattern) => boolean;

/**
 * Advanced event utility types
 */
export type EventsByCategory<Category extends string> = {
  [K in EventKeys as K extends `${Category}:${string}` ? K : never]: EventMap[K];
};

export type KernelEventsByCategory = EventsByCategory<'kernel'>;
export type PluginEventsByCategory = EventsByCategory<'plugin'>;
export type SystemEventsByCategory = EventsByCategory<'system'>;
export type DevEventsByCategory = EventsByCategory<'dev'>;

/**
 * Kernel event emitter interface
 * Defines the event emitter methods that the kernel should implement
 */
export interface KernelEventEmitter {
  on<K extends keyof EventMap>(event: K, listener: (event: EventMap[K]) => void): this;
  off<K extends keyof EventMap>(event: K, listener: (event: EventMap[K]) => void): this;
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): boolean;
  once<K extends keyof EventMap>(event: K, listener: (event: EventMap[K]) => void): this;
  removeAllListeners<K extends keyof EventMap>(event?: K): this;
  listenerCount<K extends keyof EventMap>(event: K): number;
  listeners<K extends keyof EventMap>(event: K): ((event: EventMap[K]) => void)[];
}
