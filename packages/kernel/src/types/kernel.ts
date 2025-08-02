/**
 * @fileoverview Kernel state types and configuration interfaces
 * @module @zern/kernel/types/kernel
 */

import type { PluginDefinition, PluginLoadOptions } from './plugin.js';
import { KERNEL_VERSION, PLUGIN_VERSIONS } from '../version.js';
import type {
  Prettify,
  NonEmptyArray,
  DeepReadonly,
  NonNullable,
  Result,
  Branded,
  ConfigObject,
  Optional,
  RequireAtLeastOne,
  RequireExactlyOne,
  Awaitable,
  StringLiteral,
  Validator,
  ValidationResult,
  Try,
  DeepPartial,
  EventId,
  PluginVersion,
  PickByType,
  OmitByType,
  Mutable,
  KeysOfType,
  ValuesOfType,
  PathKeys,
  PathValue,
  ValidationError,
} from './utils.js';

/**
 * Kernel lifecycle states
 */
export type KernelState =
  | 'uninitialized' // Kernel created but not initialized
  | 'initializing' // Kernel is being initialized
  | 'loading' // Kernel is loading plugins
  | 'ready' // Kernel is ready and running
  | 'starting' // Kernel is starting plugins
  | 'running' // Kernel is fully operational
  | 'stopping' // Kernel is stopping plugins
  | 'shutdown' // Kernel is shut down
  | 'error'; // Kernel encountered a critical error

/**
 * Kernel environment types
 */
export type KernelEnvironment = StringLiteral<'development' | 'test' | 'staging' | 'production'>;

/**
 * Log levels for kernel logging
 */
export type LogLevel = StringLiteral<'error' | 'warn' | 'info' | 'debug' | 'trace'>;

/**
 * Branded types for kernel identifiers
 */
export type KernelId = Branded<string, 'KernelId'>;
export type KernelVersion = Branded<string, 'KernelVersion'>;
export type KernelName = Branded<string, 'KernelName'>;
export type ConfigPath = Branded<string, 'ConfigPath'>;
export type PluginPath = Branded<string, 'PluginPath'>;
export type KernelEventId = EventId;

/**
 * Performance monitoring configuration
 */
export type PerformanceConfig = Prettify<{
  /** Enable performance monitoring */
  enabled?: boolean;
  /** Sample rate for performance metrics (0-1) */
  sampleRate?: number;
  /** Maximum number of performance entries to keep */
  maxEntries?: number;
  /** Performance metrics collection interval (ms) */
  collectInterval?: number;
  /** Enable memory monitoring */
  memoryMonitoring?: boolean;
  /** Enable CPU monitoring */
  cpuMonitoring?: boolean;
  /** Enable event loop monitoring */
  eventLoopMonitoring?: boolean;
}>;

/**
 * Plugin discovery configuration
 */
export type PluginDiscoveryConfig = Prettify<
  RequireAtLeastOne<
    {
      /** Enable automatic plugin discovery */
      enabled?: boolean;
      /** Paths to scan for plugins */
      paths?: readonly PluginPath[];
      /** Patterns to match plugin files */
      patterns?: NonEmptyArray<string>;
      /** Patterns to exclude from discovery */
      exclude?: readonly string[];
      /** Whether to scan node_modules */
      scanNodeModules?: boolean;
      /** Maximum depth for directory scanning */
      maxDepth?: number;
      /** Cache discovery results */
      cache?: boolean;
      /** Cache TTL in milliseconds */
      cacheTtl?: number;
    },
    'paths' | 'patterns'
  >
>;

/**
 * Plugin loading configuration
 */
export type PluginLoadingConfig = Prettify<{
  /** Maximum number of plugins to load concurrently */
  maxConcurrency?: number;
  /** Default timeout for plugin operations (ms) */
  timeout?: number;
  /** Whether to continue loading if a plugin fails */
  continueOnError?: boolean;
  /** Whether to validate plugin dependencies */
  validateDependencies?: boolean;
  /** Whether to auto-resolve plugin dependencies */
  autoResolveDependencies?: boolean;
  /** Whether to enable hot reload in development */
  hotReload?: boolean;
  /** Hot reload debounce time (ms) */
  hotReloadDebounce?: number;
}>;

/**
 * Security configuration
 */
export type SecurityConfig = Prettify<{
  /** Enable security checks */
  enabled?: boolean;
  /** Allowed plugin sources */
  allowedSources?: readonly string[];
  /** Blocked plugin IDs */
  blockedPlugins?: readonly string[];
  /** Enable plugin sandboxing */
  sandboxing?: boolean;
  /** Maximum memory per plugin (bytes) */
  maxMemoryPerPlugin?: number;
  /** Maximum CPU time per plugin (ms) */
  maxCpuTimePerPlugin?: number;
  /** Enable code signing verification */
  verifySignatures?: boolean;
}>;

/**
 * Development tools configuration
 */
export type DevToolsConfig = Prettify<{
  /** Enable development tools */
  enabled?: boolean;
  /** DevTools server port */
  port?: number;
  /** DevTools server host */
  host?: string;
  /** Enable plugin inspector */
  inspector?: boolean;
  /** Enable performance profiler */
  profiler?: boolean;
  /** Enable event monitor */
  eventMonitor?: boolean;
  /** Enable state viewer */
  stateViewer?: boolean;
}>;

/**
 * Logging configuration
 */
export type LoggingConfig = Prettify<{
  /** Log level */
  level?: LogLevel;
  /** Enable console logging */
  console?: boolean;
  /** Log file path */
  file?: string;
  /** Log format */
  format?: 'json' | 'text' | 'pretty';
  /** Enable timestamps */
  timestamp?: boolean;
  /** Enable stack traces for errors */
  stackTrace?: boolean;
  /** Maximum log file size (bytes) */
  maxFileSize?: number;
  /** Maximum number of log files to keep */
  maxFiles?: number;
  /** Custom log transports */
  transports?: readonly unknown[];
}>;

/**
 * Error handling configuration
 */
export type ErrorHandlingConfig = Prettify<{
  /** How to handle plugin errors */
  onPluginError?: 'ignore' | 'warn' | 'disable' | 'restart' | 'shutdown';
  /** Maximum number of restart attempts */
  maxRestartAttempts?: number;
  /** Restart delay (ms) */
  restartDelay?: number;
  /** Enable error reporting */
  reporting?: boolean;
  /** Error reporting endpoint */
  reportingEndpoint?: string;
  /** Enable crash dumps */
  crashDumps?: boolean;
  /** Crash dump directory */
  crashDumpDir?: string;
}>;

/**
 * Main kernel configuration interface
 */
export type KernelConfig = Prettify<{
  /** Kernel ID */
  id?: KernelId;

  /** Kernel environment */
  environment?: KernelEnvironment;

  /** Kernel name/identifier */
  name?: KernelName;

  /** Kernel version */
  version?: KernelVersion;

  /** Maximum number of event listeners */
  maxListeners?: number;

  /** Enable debug mode */
  debug?: boolean;

  /** Plugin discovery configuration */
  discovery?: PluginDiscoveryConfig;

  /** Plugin loading configuration */
  loading?: PluginLoadingConfig;

  /** Performance monitoring configuration */
  performance?: PerformanceConfig;

  /** Security configuration */
  security?: SecurityConfig;

  /** Development tools configuration */
  devTools?: DevToolsConfig;

  /** Minimum plugin version supported */
  minPluginVersion?: PluginVersion;

  /** Maximum plugin version supported */
  maxPluginVersion?: PluginVersion;

  /** Logging configuration */
  logging?: LoggingConfig;

  /** Error handling configuration */
  errorHandling?: ErrorHandlingConfig;

  /** Custom configuration extensions */
  extensions?: ConfigObject;

  /** Environment variables prefix */
  envPrefix?: NonNullable<string>;

  /** Configuration file paths */
  configFiles?: NonEmptyArray<ConfigPath>;

  /** Whether to watch config files for changes */
  watchConfig?: boolean;
}>;

/**
 * Kernel runtime information
 */
export type KernelInfo = Prettify<{
  /** Kernel ID */
  id: KernelId;
  /** Kernel name */
  name: KernelName;
  /** Kernel version */
  version: KernelVersion;
  /** Kernel state */
  state: KernelState;
  /** Environment */
  environment: KernelEnvironment;
  /** Start timestamp */
  startedAt: number;
  /** Uptime in milliseconds */
  uptime: number;
  /** Node.js version */
  nodeVersion: Branded<string, 'NodeVersion'>;
  /** Platform information */
  platform: DeepReadonly<{
    arch: string;
    platform: string;
    release: string;
  }>;
  /** Memory usage */
  memory: DeepReadonly<{
    used: number;
    total: number;
    external: number;
    heapUsed: number;
    heapTotal: number;
  }>;
  /** CPU usage */
  cpu: DeepReadonly<{
    user: number;
    system: number;
  }>;
  /** Plugin statistics */
  plugins: DeepReadonly<{
    total: number;
    loaded: number;
    ready: number;
    error: number;
    disabled: number;
  }>;
  /** Event statistics */
  events: DeepReadonly<{
    emitted: number;
    handled: number;
    errors: number;
  }>;
}>;

/**
 * Kernel metrics
 */
export type KernelMetrics = Prettify<{
  /** Timestamp */
  timestamp: number;
  /** Kernel info */
  kernel: DeepReadonly<KernelInfo>;
  /** Performance metrics */
  performance: DeepReadonly<{
    /** Kernel startup time (ms) */
    startupTime: number;
    /** Average plugin load time (ms) */
    avgPluginLoadTime: number;
    /** Average event processing time (ms) */
    avgEventProcessingTime: number;
    /** Events per second */
    eventsPerSecond: number;
    /** Memory growth rate (bytes/sec) */
    memoryGrowthRate: number;
    /** CPU usage percentage */
    cpuUsage: number;
    /** Event loop lag (ms) */
    eventLoopLag: number;
  }>;
  /** Plugin metrics */
  plugins: DeepReadonly<
    Record<
      string,
      {
        state: string;
        loadTime: number;
        memoryUsage: number;
        cpuTime: number;
        eventCount: number;
        errorCount: number;
      }
    >
  >;
}>;

/**
 * Kernel startup options
 */
export type KernelStartupOptions = Prettify<{
  /** Configuration override */
  config?: Partial<KernelConfig>;
  /** Plugins to load on startup */
  plugins?: readonly PluginDefinition[];
  /** Plugin load options */
  pluginOptions?: PluginLoadOptions;
  /** Whether to auto-discover plugins */
  autoDiscover?: boolean;
  /** Whether to auto-start plugins */
  autoStart?: boolean;
  /** Startup timeout (ms) */
  timeout?: number;
}>;

/**
 * Kernel shutdown options
 */
export type KernelShutdownOptions = Prettify<{
  /** Shutdown timeout (ms) */
  timeout?: number;
  /** Whether to force shutdown */
  force?: boolean;
  /** Whether to save state before shutdown */
  saveState?: boolean;
  /** Graceful shutdown signal */
  signal?: 'SIGTERM' | 'SIGINT' | 'SIGKILL';
}>;

/**
 * Kernel event context
 */
export type KernelEventContext = Prettify<{
  /** Event ID */
  id: KernelEventId;
  /** Kernel instance */
  kernel: unknown; // Will be ZernKernel
  /** Event timestamp */
  timestamp: number;
  /** Event source */
  source: NonNullable<string>;
  /** Event metadata */
  metadata?: DeepReadonly<Record<string, unknown>>;
}>;

/**
 * Kernel operation result
 */
export type KernelOperationResult<T = unknown> = Result<
  {
    data: T;
    duration: number;
    metadata?: DeepReadonly<Record<string, unknown>>;
  },
  Error
>;

/**
 * Async kernel operation result
 */
export type AsyncKernelOperation<T = unknown> = Awaitable<KernelOperationResult<T>>;

/**
 * Kernel configuration validation result
 */
export type KernelConfigValidation = ValidationResult<KernelConfig>;

/**
 * Partial kernel configuration for updates
 */
export type PartialKernelConfig = DeepPartial<KernelConfig>;

/**
 * Kernel configuration validator
 */
export type KernelConfigValidator = Validator<KernelConfig>;

/**
 * Factory functions for branded types
 */
export function createKernelId(id: string): KernelId {
  return id as KernelId;
}

export function createKernelName(name: string): KernelName {
  return name as KernelName;
}

export function createKernelVersion(version: string): KernelVersion {
  return version as KernelVersion;
}

export function createConfigPath(path: string): ConfigPath {
  return path as ConfigPath;
}

export function createPluginPath(path: string): PluginPath {
  return path as PluginPath;
}

export function createKernelEventId(id: string): KernelEventId {
  return id as KernelEventId;
}

/**
 * Default kernel configuration
 */
export const DEFAULT_KERNEL_CONFIG: Required<KernelConfig> = {
  id: createKernelId('default-kernel'),
  environment: 'development',
  name: createKernelName('zern-kernel'),
  version: createKernelVersion(KERNEL_VERSION),
  maxListeners: 100,
  debug: false,
  discovery: {
    enabled: true,
    paths: [
      createPluginPath('./plugins'),
      createPluginPath('./node_modules/@zern/plugin-*'),
    ] as const,
    patterns: ['**/*.plugin.{js,ts}', '**/plugin.{js,ts}'] as NonEmptyArray<string>,
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'] as const,
    scanNodeModules: true,
    maxDepth: 3,
    cache: true,
    cacheTtl: 300000, // 5 minutes
  },
  loading: {
    maxConcurrency: 10,
    timeout: 30000, // 30 seconds
    continueOnError: true,
    validateDependencies: true,
    autoResolveDependencies: true,
    hotReload: false,
    hotReloadDebounce: 1000,
  },
  performance: {
    enabled: true,
    sampleRate: 1.0,
    maxEntries: 1000,
    collectInterval: 5000,
    memoryMonitoring: true,
    cpuMonitoring: true,
    eventLoopMonitoring: true,
  },
  security: {
    enabled: true,
    allowedSources: [],
    blockedPlugins: [],
    sandboxing: false,
    maxMemoryPerPlugin: 100 * 1024 * 1024, // 100MB
    maxCpuTimePerPlugin: 10000, // 10 seconds
    verifySignatures: false,
  },
  devTools: {
    enabled: false,
    port: 9229,
    host: 'localhost',
    inspector: true,
    profiler: true,
    eventMonitor: true,
    stateViewer: true,
  },
  minPluginVersion: PLUGIN_VERSIONS.MIN as PluginVersion,
  maxPluginVersion: PLUGIN_VERSIONS.MAX as PluginVersion,
  logging: {
    level: 'info',
    console: true,
    format: 'pretty',
    timestamp: true,
    stackTrace: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    transports: [],
  },
  errorHandling: {
    onPluginError: 'warn',
    maxRestartAttempts: 3,
    restartDelay: 5000,
    reporting: false,
    crashDumps: false,
    crashDumpDir: './crash-dumps',
  },
  extensions: {},
  envPrefix: 'ZERN_',
  configFiles: [
    createConfigPath('zern.config.js'),
    createConfigPath('zern.config.json'),
    createConfigPath('.zernrc'),
  ] as NonEmptyArray<ConfigPath>,
  watchConfig: true,
};

/**
 * Kernel startup operation with specific requirements
 */
export type KernelStartupOperation = RequireAtLeastOne<
  KernelStartupOptions,
  'config' | 'plugins' | 'autoDiscover'
>;

/**
 * Kernel shutdown operation result
 */
export type KernelShutdownResult = Try<{
  graceful: boolean;
  duration: number;
  pluginsStopped: number;
  errors: Error[];
}>;

/**
 * Optional kernel configuration for partial updates
 */
export type OptionalKernelConfig<K extends keyof KernelConfig> = Optional<KernelConfig, K>;

/**
 * Advanced kernel configuration types using utility types
 */

/**
 * Kernel configuration with exactly one required property
 */
export type KernelConfigWithExactlyOne<K extends keyof KernelConfig> = RequireExactlyOne<
  KernelConfig,
  K
>;

/**
 * Mutable version of kernel configuration (removes readonly modifiers)
 */
export type MutableKernelConfig = Mutable<DeepReadonly<KernelConfig>>;

/**
 * Pick only boolean properties from KernelConfig
 */
export type KernelBooleanConfig = PickByType<KernelConfig, boolean>;

/**
 * Omit all boolean properties from KernelConfig
 */
export type KernelNonBooleanConfig = OmitByType<KernelConfig, boolean>;

/**
 * Get all keys that have string values in KernelConfig
 */
export type KernelStringKeys = KeysOfType<KernelConfig, string>;

/**
 * Get all string values from KernelConfig
 */
export type KernelStringValues = ValuesOfType<KernelConfig, string>;

/**
 * Path-based configuration access
 */
export type KernelConfigPaths = PathKeys<KernelConfig>;
export type KernelConfigPathValue<P extends KernelConfigPaths> = P extends string
  ? PathValue<KernelConfig, P>
  : never;

/**
 * Enhanced kernel operation with validation errors
 */
export type KernelValidationResult<T = unknown> = Result<T, ValidationError[]>;

/**
 * Kernel configuration validator with detailed errors
 */
export type DetailedKernelConfigValidator = (
  config: unknown
) => KernelValidationResult<KernelConfig>;

/**
 * Environment-specific kernel configurations
 */

/**
 * Development-specific kernel configuration
 * Requires exactly one of debug, devTools, or hotReload to be specified
 */
export type DevelopmentKernelConfig = KernelConfig & {
  environment: 'development';
} & RequireExactlyOne<
    Pick<KernelConfig, 'debug'> & {
      devTools?: DevToolsConfig & { enabled: true };
      hotReload?: boolean;
    },
    'debug' | 'devTools' | 'hotReload'
  >;

/**
 * Production-specific kernel configuration
 * Omits development-specific properties
 */
export type ProductionKernelConfig = KernelConfig & {
  environment: 'production';
  debug?: false;
  devTools?: DevToolsConfig & { enabled: false };
};

/**
 * Kernel configuration factory types
 */
export type KernelConfigFactory<T extends KernelConfig = KernelConfig> = (
  baseConfig?: Partial<T>
) => T;

/**
 * Environment-specific config factories
 */
export type DevelopmentConfigFactory = KernelConfigFactory<DevelopmentKernelConfig>;
export type ProductionConfigFactory = KernelConfigFactory<ProductionKernelConfig>;

/**
 * Type guard to check if object is KernelConfig
 */
export function isKernelConfig(obj: unknown): obj is KernelConfig {
  return typeof obj === 'object' && obj !== null;
}
