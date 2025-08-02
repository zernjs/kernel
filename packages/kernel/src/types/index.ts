/**
 * @fileoverview Type definitions index for the Zern Kernel
 * @module @zern/kernel/types
 */

// Core plugin types
export type {
  PluginId,
  PluginVersion,
  Plugin,
  PluginState,
  PluginPriority,
  PluginOperationResult,
  PluginLifecycleContext,
  PluginLifecycleHooks,
  PluginDependency,
  PluginCapability,
  PluginHealthCheck,
  PluginConstructor,
  PluginFactory,
  PluginDefinition,
  PluginInstance,
  PluginLoadOptions,
  PluginUnloadOptions,
  PluginSearchCriteria,
  PluginDevelopmentConfig,
  PluginRegistrationData,
} from './plugin.js';

// Plugin utility functions
export {
  isPlugin,
  isPluginConstructor,
  isPluginFactory,
  createPluginId,
  createPluginVersion,
} from './plugin.js';

// Plugin metadata and configuration types
export type {
  PluginMetadata,
  PluginAuthor,
  PluginRepository,
  PluginBuildInfo,
  PluginRequirements,
  PluginExternalDependency,
  PluginFeatures,
  PluginDeprecationInfo,
  PluginSecurityInfo,
  PluginVulnerability,
  PluginPermission,
  PluginPerformanceHints,
  PluginConfig,
  PluginConfigWithMetadata,
} from './metadata.js';

// Plugin metadata utility functions
export {
  isPluginMetadata,
  isPluginConfig,
  createDefaultPluginMetadata,
  createPluginDevelopmentConfig,
  validatePluginMetadata,
  createPluginSearchCriteria,
} from './metadata.js';

// Kernel types
export type {
  // Basic kernel types
  KernelState,
  KernelEnvironment,
  LogLevel,

  // Branded types
  KernelId,
  KernelVersion,
  KernelName,
  ConfigPath,
  PluginPath,
  KernelEventId,

  // Configuration types
  PerformanceConfig,
  PluginDiscoveryConfig,
  PluginLoadingConfig,
  SecurityConfig,
  DevToolsConfig,
  LoggingConfig,
  ErrorHandlingConfig,
  KernelConfig,

  // Runtime types
  KernelInfo,
  KernelMetrics,
  KernelStartupOptions,
  KernelShutdownOptions,
  KernelEventContext,
  KernelOperationResult,

  // Advanced operation types
  AsyncKernelOperation,
  KernelConfigValidation,
  PartialKernelConfig,
  KernelConfigValidator,
  KernelStartupOperation,
  KernelShutdownResult,

  // Utility configuration types
  OptionalKernelConfig,
  KernelConfigWithExactlyOne,
  MutableKernelConfig,
  KernelBooleanConfig,
  KernelNonBooleanConfig,
  KernelStringKeys,
  KernelStringValues,
  KernelConfigPaths,
  KernelConfigPathValue,
  KernelValidationResult,
  DetailedKernelConfigValidator,

  // Environment-specific types
  DevelopmentKernelConfig,
  ProductionKernelConfig,
  KernelConfigFactory,
  DevelopmentConfigFactory,
  ProductionConfigFactory,
} from './kernel.js';

// Kernel utility functions
export {
  createKernelId,
  createKernelName,
  createKernelVersion,
  createConfigPath,
  createPluginPath,
  createKernelEventId,
  isKernelConfig,
} from './kernel.js';

// Kernel constants
export { DEFAULT_KERNEL_CONFIG } from './kernel.js';

// Event types
export type {
  // Basic event types
  BaseEvent,
  EventPriority,
  EventPropagation,
  EventContext,
  EventHandler,
  EventListenerConfig,
  EventEmitOptions,

  // Branded event types
  EventType,
  EventSource,
  EventSubscriptionId,
  EventHandlerId,

  // Event map types
  KernelLifecycleEvents,
  PluginLifecycleEvents,
  SystemEvents,
  DevelopmentEvents,
  EventMap,

  // Event utility types
  EventKeys,
  EventValues,
  EventTypeFromKey,
  EventListenerRegistry,
  EventSubscriptionType,
  EventEmitterMethods,

  // Specific event interfaces
  KernelInitializingEvent,
  KernelInitializedEvent,
  KernelLoadingEvent,
  KernelReadyEvent,
  KernelStartingEvent,
  KernelStartedEvent,
  KernelStoppingEvent,
  KernelStoppedEvent,
  KernelShutdownEvent,
  KernelErrorEvent,
  KernelStateChangedEvent,
  PluginDiscoveredEvent,
  PluginLoadingEvent,
  PluginLoadedEvent,
  PluginInitializingEvent,
  PluginInitializedEvent,
  PluginStartingEvent,
  PluginStartedEvent,
  PluginStoppingEvent,
  PluginStoppedEvent,
  PluginUnloadingEvent,
  PluginUnloadedEvent,
  PluginErrorEvent,
  PluginStateChangedEvent,
  PluginDependencyResolvedEvent,
  PluginHealthCheckEvent,
  SystemPerformanceEvent,
  SystemMemoryWarningEvent,
  SystemCpuWarningEvent,
  SystemErrorEvent,
  SystemMetricsEvent,
  SystemConfigChangedEvent,
  SystemHotReloadEvent,
  DevFileChangedEvent,
  DevPluginReloadedEvent,
  DevDebugEvent,
  DevProfilerEvent,

  // Event processing types
  EventSubscription,
  EventMiddleware,
  EventFilter,
  EventTransformer,

  // Event utility and helper types
  EventTypeKey,
  EventData,
  EventHandlerFor,
  EventNames,
  IsValidEventType,
  EventStatistics,
  EventValidationResult,
  EventMetadataKeys,
  EventMetadataValue,
  EventDataKeys,
  EventDataValue,
  EventsWithData,
  EventsWithoutData,
  EventsOfType,
  MutableEvent,
  EventCreationData,
  EventFactory,
  EventBatch,
  EventBatchProcessor,
  EventAggregator,
  EventPattern,
  EventMatcher,

  // Event categorization types
  EventsByCategory,
  KernelEventsByCategory,
  PluginEventsByCategory,
  SystemEventsByCategory,
  DevEventsByCategory,
} from './events.js';

// Event utility functions
export {
  createEventType,
  createEventSource,
  createEventSubscriptionId,
  createEventHandlerId,
  isEvent,
  isEventContext,
  isEventOfType,
  hasEventData,
  getEventType,
} from './events.js';

// State management types
export type {
  // Basic state types
  StateOperation,
  StateFormat,
  PersistenceStrategy,

  // Branded state types
  StateSnapshotId,
  StateDiffId,
  StateWatcherId,
  StateNamespace,

  // State validation and processing
  StateValidationResult,
  StateValidator,
  StateTransformer,
  StateMiddleware,
  StateOperationResult,

  // State events and changes
  StateChangeEvent,

  // State snapshots and diffs
  StateSnapshot,
  StateDiffEntry,
  StateDiff,

  // State queries and watching
  StateQueryOptions,
  StateWatchOptions,
  StateWatcher,

  // State persistence and schema
  StatePersistenceOptions,
  StateSchema,
  StateNamespaceConfig,

  // State manager interface
  StateManager,

  // State statistics and data
  StateStatistics,
  PluginState as PluginStateData,
  KernelStateData,
} from './state.js';

// State utility functions
export {
  isStateChangeEvent,
  isStateSnapshot,
  isStateDiff,
  createStateSnapshotId,
  createStateDiffId,
  createStateWatcherId,
  createStateNamespace,
} from './state.js';

// State utility class
export { StatePath } from './state.js';

// Utility types
export type {
  // Basic utility types
  Branded,
  DeepPartial,
  DeepReadonly,
  NonEmptyArray,
  Prettify,
  UnionToIntersection,
  PickByType,
  OmitByType,
  RequireAtLeastOne,
  RequireExactlyOne,
  Mutable,
  Optional,
  Nullable,
  NonNullable as StrictNonNullable,

  // Function utilities
  AnyFunction,
  AsyncFunction,

  // Promise utilities
  Awaitable,
  PromiseValue,

  // Object utilities
  KeysOfType,
  ValuesOfType,

  // String utilities
  StringLiteral,
  Join,
  Split,

  // Tuple utilities
  Head,
  Tail,
  Last,
  Length,

  // Conditional utilities
  If,
  Not,
  And,
  Or,

  // Type assertion utilities
  Assert,
  IsEqual,
  IsNever,
  IsAny,
  IsUnknown,

  // Path utilities
  PathKeys,
  PathValue,

  // Error handling utilities
  Result,
  Try,

  // Event utilities (from utils.ts)
  EventMap as UtilEventMap,
  EventKey,
  EventReceiver,

  // Configuration utilities
  ConfigValue,
  ConfigObject,

  // Validation utilities
  Validator,
  ValidationError,
  ValidationResult,

  // Plugin utilities (branded types from utils.ts)
  PluginId as UtilPluginId,
  PluginVersion as UtilPluginVersion,
  EventId as UtilEventId,
  StatePathString,
} from './utils.js';

// Utility functions
export {
  // Factory functions for branded types
  createPluginId as createUtilPluginId,
  createPluginVersion as createUtilPluginVersion,
  createEventId as createUtilEventId,
  createStatePath,

  // Type guards
  isString,
  isNumber,
  isBoolean,
  isObject,
  isArray,
  isFunction,
  isPromise,
  isError,
  isNullish,
  isDefined,
  isNotNull,
  isNotNullish,
} from './utils.js';

// Version information (re-exported from centralized version file)
export {
  KERNEL_VERSION,
  API_VERSION,
  TYPES_VERSION,
  PLUGIN_VERSIONS,
  CONFIG_VERSIONS,
  BUILD_VERSIONS,
  VERSIONS,
  VersionUtils,
} from '../version.js';
