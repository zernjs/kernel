/**
 * @fileoverview Core plugin interface and related types for the Zern Kernel
 * @module @zern/kernel/types/plugin
 */

import type { ZernKernel } from '../kernel.js';
import type { PluginMetadata, PluginConfig } from './metadata.js';
import type { EventMap } from './events.js';
import type {
  Branded,
  NonEmptyArray,
  Nullable,
  NonNullable,
  Prettify,
  Awaitable,
  RequireAtLeastOne,
  Optional,
  DeepReadonly,
  ValidationResult,
  ValidationError,
  Result,
} from './utils.js';

/**
 * Branded types for plugin system
 */
export type PluginId = Branded<string, 'PluginId'>;
export type PluginVersion = Branded<string, 'PluginVersion'>;

/**
 * Plugin lifecycle states
 */
export type PluginState =
  | 'unloaded' // Plugin not loaded
  | 'loading' // Plugin is being loaded
  | 'loaded' // Plugin loaded but not initialized
  | 'initializing' // Plugin is being initialized
  | 'ready' // Plugin is ready and active
  | 'error' // Plugin encountered an error
  | 'disabled' // Plugin is disabled
  | 'destroying' // Plugin is being destroyed
  | 'destroyed'; // Plugin has been destroyed

/**
 * Plugin priority levels for load order
 */
export type PluginPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * Plugin operation result type
 */
export type PluginOperationResult<T = void> = Result<T, ValidationError[]>;

/**
 * Plugin lifecycle hooks context
 */
export interface PluginLifecycleContext {
  /** The kernel instance */
  kernel: ZernKernel;
  /** Plugin configuration */
  config: PluginConfig;
  /** Plugin state */
  state: PluginState;
  /** Timestamp when the hook was called */
  timestamp: number;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycleHooks {
  /**
   * Called before plugin initialization
   * Use for validation and preparation
   */
  beforeInit?(context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Main plugin initialization
   * Required hook - must be implemented
   */
  init(context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Called after plugin initialization
   * Use for post-initialization setup
   */
  afterInit?(context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Called when plugin is being started
   * Use for starting services, connections, etc.
   */
  start?(context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Called when plugin is being stopped
   * Use for graceful shutdown of services
   */
  stop?(context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Called before plugin destruction
   * Use for cleanup preparation
   */
  beforeDestroy?(context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Called during plugin destruction
   * Use for resource cleanup
   */
  destroy?(context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Called after plugin destruction
   * Use for final cleanup
   */
  afterDestroy?(context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Called when plugin encounters an error
   * Use for error handling and recovery
   */
  onError?(error: Error, context: PluginLifecycleContext): Awaitable<void>;

  /**
   * Called when plugin configuration changes
   * Use for dynamic reconfiguration
   */
  onConfigChange?(
    newConfig: PluginConfig,
    oldConfig: PluginConfig,
    context: PluginLifecycleContext
  ): Awaitable<void>;
}

/**
 * Plugin dependency specification
 */
export interface PluginDependency {
  /** Plugin ID */
  id: PluginId;
  /** Version constraint (semver) */
  version?: PluginVersion;
  /** Whether this dependency is optional */
  optional?: boolean;
  /** Minimum required version */
  minVersion?: PluginVersion;
  /** Maximum supported version */
  maxVersion?: PluginVersion;
}

/**
 * Plugin capability definition
 */
export interface PluginCapability {
  /** Capability name */
  name: NonNullable<string>;
  /** Capability version */
  version: PluginVersion;
  /** Capability description */
  description?: string;
  /** Capability API */
  api?: DeepReadonly<Record<string, unknown>>;
}

/**
 * Plugin health check result
 */
export interface PluginHealthCheck {
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Health message */
  message?: Nullable<string>;
  /** Additional details */
  details?: Nullable<Record<string, unknown>>;
  /** Timestamp of the check */
  timestamp: number;
}

/**
 * Main Plugin interface
 * All plugins must implement this interface
 */
export type Plugin = Prettify<
  PluginLifecycleHooks & {
    /** Unique plugin identifier */
    readonly id: PluginId;

    /** Plugin version (semver) */
    readonly version: PluginVersion;

    /** Plugin display name */
    readonly name?: string;

    /** Plugin description */
    readonly description?: string;

    /** Plugin author */
    readonly author?: string;

    /** Plugin license */
    readonly license?: string;

    /** Plugin homepage URL */
    readonly homepage?: string;

    /** Plugin repository URL */
    readonly repository?: string;

    /** Plugin keywords for discovery */
    readonly keywords?: NonEmptyArray<string>;

    /** Plugin dependencies */
    readonly dependencies?: NonEmptyArray<PluginId | PluginDependency>;

    /** Optional plugin dependencies */
    readonly optionalDependencies?: NonEmptyArray<PluginId | PluginDependency>;

    /** Plugins that must load after this one */
    readonly dependents?: NonEmptyArray<PluginId>;

    /** Plugin load priority */
    readonly priority?: PluginPriority;

    /** Plugin capabilities */
    readonly capabilities?: NonEmptyArray<PluginCapability>;

    /** Default plugin configuration */
    readonly defaultConfig?: PluginConfig;

    /** Configuration schema for validation */
    readonly configSchema?: unknown; // Will be Zod schema or similar

    /** Plugin metadata */
    readonly metadata: PluginMetadata;

    /** Whether plugin supports hot reload */
    readonly hotReloadable?: boolean;

    /** Whether plugin is singleton (only one instance) */
    readonly singleton?: boolean;

    /** Minimum kernel version required */
    readonly kernelVersion?: PluginVersion;

    /** Node.js version requirements */
    readonly nodeVersion?: PluginVersion;

    /** Platform requirements */
    readonly platforms?: NonEmptyArray<'win32' | 'darwin' | 'linux' | 'freebsd'>;

    /** Plugin tags for categorization */
    readonly tags?: NonEmptyArray<string>;

    /**
     * Plugin health check
     * Used for monitoring and diagnostics
     */
    healthCheck?(): Awaitable<PluginHealthCheck>;

    /**
     * Get plugin metrics
     * Used for monitoring and performance tracking
     */
    getMetrics?(): Awaitable<Record<string, unknown>>;

    /**
     * Get plugin status information
     */
    getStatus?(): Awaitable<Record<string, unknown>>;

    /**
     * Validate plugin configuration
     */
    validateConfig?(config: PluginConfig): Awaitable<ValidationResult<PluginConfig>>;

    /**
     * Plugin-specific event handlers
     */
    eventHandlers?: Partial<{
      [K in keyof EventMap]: (event: EventMap[K]) => Awaitable<void>;
    }>;
  }
>;

/** Plugin constructor interface */
export interface PluginConstructor {
  new (...args: unknown[]): Plugin;
}

/**
 * Plugin factory function
 */
export type PluginFactory = (...args: unknown[]) => Awaitable<Plugin>;

/**
 * Plugin definition for registration
 */
export type PluginDefinition = Plugin | PluginConstructor | PluginFactory;

/**
 * Plugin instance with runtime information
 */
export type PluginInstance = Prettify<{
  /** The plugin implementation */
  plugin: Plugin;
  /** Current plugin state */
  state: PluginState;
  /** Plugin configuration */
  config: PluginConfig;
  /** Load timestamp */
  loadedAt: number;
  /** Initialization timestamp */
  initializedAt?: Nullable<number>;
  /** Start timestamp */
  startedAt?: Nullable<number>;
  /** Error information if any */
  error?: Nullable<Error>;
  /** Plugin metrics */
  metrics?: Nullable<Record<string, unknown>>;
  /** Plugin dependencies (resolved) */
  resolvedDependencies: PluginId[];
  /** Plugin dependents (resolved) */
  resolvedDependents: PluginId[];
}>;

/**
 * Plugin load options
 */
export type PluginLoadOptions = Prettify<{
  /** Plugin configuration override */
  config?: PluginConfig;
  /** Whether to auto-start the plugin */
  autoStart?: boolean;
  /** Load timeout in milliseconds */
  timeout?: number;
  /** Whether to skip dependency validation */
  skipDependencyValidation?: boolean;
  /** Whether to force reload if already loaded */
  force?: boolean;
}>;

/**
 * Plugin unload options
 */
export type PluginUnloadOptions = Prettify<{
  /** Unload timeout in milliseconds */
  timeout?: number;
  /** Whether to force unload even if dependents exist */
  force?: boolean;
  /** Whether to unload dependents as well */
  cascade?: boolean;
}>;

/**
 * Plugin search criteria - requires at least one search parameter
 */
export type PluginSearchCriteria = Prettify<
  RequireAtLeastOne<{
    /** Plugin ID pattern */
    id?: PluginId | RegExp;
    /** Plugin name pattern */
    name?: string | RegExp;
    /** Plugin state filter */
    state?: PluginState | NonEmptyArray<PluginState>;
    /** Plugin tags filter */
    tags?: NonEmptyArray<string>;
    /** Plugin capabilities filter */
    capabilities?: NonEmptyArray<string>;
    /** Plugin author filter */
    author?: string;
    /** Plugin version constraint */
    version?: PluginVersion;
  }>
>;

/**
 * Plugin configuration for development - makes metadata optional
 */
export type PluginDevelopmentConfig = Optional<Plugin, 'metadata'>;

/**
 * Plugin registration data - makes certain runtime properties optional
 */
export type PluginRegistrationData = Optional<
  Plugin,
  'hotReloadable' | 'singleton' | 'kernelVersion' | 'nodeVersion' | 'platforms'
>;

/**
 * Type guard to check if object is a Plugin
 */
export function isPlugin(obj: unknown): obj is Plugin {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'version' in obj &&
    'init' in obj &&
    'metadata' in obj &&
    typeof (obj as Plugin).id === 'string' &&
    typeof (obj as Plugin).version === 'string' &&
    typeof (obj as Plugin).init === 'function'
  );
}

/**
 * Type guard to check if object is a PluginConstructor
 */
export function isPluginConstructor(obj: unknown): obj is PluginConstructor {
  return typeof obj === 'function' && obj.prototype && 'init' in obj.prototype;
}

/**
 * Type guard to check if object is a PluginFactory
 */
export function isPluginFactory(obj: unknown): obj is PluginFactory {
  return typeof obj === 'function';
}

/**
 * Factory functions for branded types
 */
export function createPluginId(id: string): PluginId {
  return id as PluginId;
}

export function createPluginVersion(version: string): PluginVersion {
  return version as PluginVersion;
}
