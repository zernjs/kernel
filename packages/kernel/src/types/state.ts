/**
 * @fileoverview State management types and interfaces
 * @module @zern/kernel/types/state
 */

import type { Plugin } from './plugin.js';
import type { BaseEvent } from './events.js';
import type {
  Awaitable,
  StatePathString,
  ConfigObject,
  ValidationError,
  AnyFunction,
  DeepPartial,
  Result,
  NonEmptyArray,
  Nullable,
  NonNullable,
  Prettify,
  PathKeys,
  PathValue,
  Branded,
} from './utils.js';

import { isString, isNumber, isObject, isArray, isNotNullish } from './utils.js';

/**
 * Branded types for state system
 */
export type StateSnapshotId = Branded<string, 'StateSnapshotId'>;
export type StateDiffId = Branded<string, 'StateDiffId'>;
export type StateWatcherId = Branded<string, 'StateWatcherId'>;
export type StateNamespace = Branded<string, 'StateNamespace'>;

/**
 * State change operation types
 */
export type StateOperation = 'set' | 'update' | 'delete' | 'clear' | 'merge';

/**
 * State serialization formats
 */
export type StateFormat = 'json' | 'binary' | 'custom';

/**
 * State persistence strategies
 */
export type PersistenceStrategy = 'none' | 'memory' | 'file' | 'database' | 'custom';

/**
 * State validation result
 */
export interface StateValidationResult {
  /** Whether state is valid */
  valid: boolean;
  /** Validation errors */
  errors?: NonEmptyArray<ValidationError>;
  /** Validation warnings */
  warnings?: NonEmptyArray<string>;
  /** Validation metadata */
  metadata?: ConfigObject;
}

/**
 * State operation result
 */
export type StateOperationResult<T = void> = Result<T, ValidationError[]>;

/**
 * State validator function
 */
export type StateValidator<T = unknown> = (
  value: T,
  path: StatePathString,
  operation: StateOperation
) => Awaitable<StateValidationResult>;

/**
 * State transformer function
 */
export type StateTransformer<T = unknown, R = unknown> = (
  value: T,
  path: StatePathString,
  operation: StateOperation
) => Awaitable<R>;

/**
 * State middleware function
 */
export type StateMiddleware = (
  operation: StateOperation,
  path: StatePathString,
  value: unknown,
  next: AnyFunction
) => Awaitable<void>;

/**
 * State change event
 */
export interface StateChangeEvent extends BaseEvent {
  type: 'state:changed';
  data: {
    /** State path that changed */
    path: StatePathString;
    /** Operation performed */
    operation: StateOperation;
    /** Previous value */
    previousValue?: unknown;
    /** New value */
    newValue?: unknown;
    /** Change metadata */
    metadata?: ConfigObject;
    /** Plugin that made the change */
    plugin?: string;
  };
}

/**
 * State snapshot
 */
export interface StateSnapshot {
  /** Snapshot ID */
  id: StateSnapshotId;
  /** Snapshot timestamp */
  timestamp: number;
  /** Snapshot data */
  data: ConfigObject;
  /** Snapshot metadata */
  metadata?: Nullable<ConfigObject>;
  /** Snapshot version */
  version: string;
  /** Snapshot checksum */
  checksum?: Nullable<string>;
}

/**
 * State diff entry
 */
export interface StateDiffEntry {
  /** Path of the change */
  path: StatePathString;
  /** Operation performed */
  operation: StateOperation;
  /** Previous value */
  previousValue?: unknown;
  /** New value */
  newValue?: unknown;
}

/**
 * State diff
 */
export interface StateDiff {
  /** Diff ID */
  id: StateDiffId;
  /** Source snapshot ID */
  fromSnapshot: StateSnapshotId;
  /** Target snapshot ID */
  toSnapshot: StateSnapshotId;
  /** Diff timestamp */
  timestamp: number;
  /** Diff entries */
  entries: NonEmptyArray<StateDiffEntry>;
  /** Diff metadata */
  metadata?: Nullable<ConfigObject>;
}

/**
 * State query options
 */
export interface StateQueryOptions<T = unknown> {
  /** Include nested paths */
  deep?: boolean;
  /** Maximum depth for nested queries */
  maxDepth?: number;
  /** Filter function */
  filter?: (value: unknown, path: StatePathString) => boolean;
  /** Transform function */
  transform?: StateTransformer;
  /** Default value if path doesn't exist */
  defaultValue?: T;
  /** Paths to include in query */
  include?: PathKeys<T>[];
  /** Paths to exclude from query */
  exclude?: PathKeys<T>[];
}

/**
 * State watch options
 */
export interface StateWatchOptions {
  /** Watch nested paths */
  deep?: boolean;
  /** Immediate callback on watch */
  immediate?: boolean;
  /** Debounce time (ms) */
  debounce?: number;
  /** Throttle time (ms) */
  throttle?: number;
  /** Filter changes */
  filter?: (change: StateChangeEvent) => boolean;
}

/**
 * State watcher
 */
export interface StateWatcher {
  /** Watcher ID */
  id: StateWatcherId;
  /** Watched path pattern */
  pattern: StatePathString | RegExp;
  /** Watcher callback */
  callback: (event: StateChangeEvent) => Awaitable<void>;
  /** Watcher options */
  options: StateWatchOptions;
  /** Plugin that created the watcher */
  plugin?: string;
  /** Unwatch function */
  unwatch(): void;
}

/**
 * State persistence options
 */
export interface StatePersistenceOptions {
  /** Persistence strategy */
  strategy: PersistenceStrategy;
  /** Persistence key/path */
  key?: string;
  /** Serialization format */
  format?: StateFormat;
  /** Auto-save interval (ms) */
  autoSaveInterval?: number;
  /** Compression enabled */
  compression?: boolean;
  /** Encryption enabled */
  encryption?: boolean;
  /** Custom serializer */
  serializer?: {
    serialize: (data: unknown) => string | Buffer;
    deserialize: (data: string | Buffer) => unknown;
  };
}

/**
 * State schema definition
 */
export interface StateSchema {
  /** Schema type */
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  /** Schema properties (for objects) */
  properties?: Record<string, StateSchema>;
  /** Schema items (for arrays) */
  items?: StateSchema;
  /** Required properties */
  required?: string[];
  /** Additional properties allowed */
  additionalProperties?: boolean;
  /** Minimum value/length */
  minimum?: number;
  /** Maximum value/length */
  maximum?: number;
  /** Pattern for strings */
  pattern?: string;
  /** Enum values */
  enum?: unknown[];
  /** Default value */
  default?: unknown;
  /** Schema description */
  description?: string;
  /** Custom validator */
  validator?: StateValidator;
}

/**
 * State namespace configuration
 */
export interface StateNamespaceConfig {
  /** Namespace name */
  name: StateNamespace;
  /** Namespace schema */
  schema?: Nullable<StateSchema>;
  /** Namespace validators */
  validators?: NonEmptyArray<StateValidator>;
  /** Namespace transformers */
  transformers?: NonEmptyArray<StateTransformer>;
  /** Namespace middleware */
  middleware?: NonEmptyArray<StateMiddleware>;
  /** Persistence options */
  persistence?: Nullable<StatePersistenceOptions>;
  /** Access control */
  access?: {
    read?: NonEmptyArray<string>;
    write?: NonEmptyArray<string>;
    delete?: NonEmptyArray<string>;
  };
  /** Namespace metadata */
  metadata?: Nullable<ConfigObject>;
}

/**
 * State manager interface
 */
export type StateManager = Prettify<{
  /**
   * Get state value at path
   */
  get<T = unknown>(path: StatePathString, options?: StateQueryOptions<T>): T | undefined;

  /**
   * Get typed value at path using PathValue
   */
  getTyped<T extends ConfigObject, P extends PathKeys<T>>(
    path: P,
    data: T,
    options?: StateQueryOptions<PathValue<T, P>>
  ): PathValue<T, P> | undefined;

  /**
   * Set state value at path
   */
  set<T = unknown>(
    path: NonNullable<StatePathString>,
    value: NonNullable<T>,
    metadata?: ConfigObject
  ): Promise<StateOperationResult>;

  /**
   * Update state value at path
   */
  update<T = unknown>(
    path: NonNullable<StatePathString>,
    updater: (current: T) => NonNullable<T>,
    metadata?: ConfigObject
  ): Promise<StateOperationResult>;

  /**
   * Set typed value at path using PathValue
   */
  setTyped<T extends ConfigObject, P extends PathKeys<T>>(
    path: P,
    value: NonNullable<PathValue<T, P>>,
    metadata?: ConfigObject
  ): Promise<StateOperationResult>;

  /**
   * Delete state at path
   */
  delete(path: StatePathString, metadata?: ConfigObject): Promise<StateOperationResult>;

  /**
   * Check if path exists
   */
  has(path: StatePathString): boolean;

  /**
   * Get all keys at path
   */
  keys(path?: StatePathString): string[];

  /**
   * Clear all state or state at path
   */
  clear(path?: StatePathString, metadata?: ConfigObject): Promise<StateOperationResult>;

  /**
   * Merge object into state at path
   */
  merge<T extends ConfigObject>(
    path: StatePathString,
    value: DeepPartial<T>,
    metadata?: ConfigObject
  ): Promise<StateOperationResult>;

  /**
   * Watch for state changes
   */
  watch(
    pattern: StatePathString | RegExp,
    callback: (event: StateChangeEvent) => Awaitable<void>,
    options?: StateWatchOptions
  ): StateWatcher;

  /**
   * Create state snapshot
   */
  snapshot(metadata?: ConfigObject): Promise<StateSnapshot>;

  /**
   * Restore from snapshot
   */
  restore(
    snapshot: StateSnapshot | StateSnapshotId,
    metadata?: ConfigObject
  ): Promise<StateOperationResult>;

  /**
   * Create diff between snapshots
   */
  diff(
    from: StateSnapshot | StateSnapshotId,
    to: StateSnapshot | StateSnapshotId
  ): Promise<StateDiff>;

  /**
   * Apply diff to current state
   */
  applyDiff(diff: StateDiff, metadata?: ConfigObject): Promise<StateOperationResult>;

  /**
   * Validate state at path
   */
  validate(path?: StatePathString): Promise<StateValidationResult>;

  /**
   * Create namespace
   */
  createNamespace(config: StateNamespaceConfig): Promise<StateOperationResult>;

  /**
   * Delete namespace
   */
  deleteNamespace(name: StateNamespace): Promise<StateOperationResult>;

  /**
   * Get namespace
   */
  getNamespace(name: StateNamespace): StateNamespaceConfig | undefined;

  /**
   * List namespaces
   */
  listNamespaces(): StateNamespace[];

  /**
   * Save state to persistence
   */
  save(path?: StatePathString): Promise<StateOperationResult>;

  /**
   * Load state from persistence
   */
  load(path?: StatePathString): Promise<StateOperationResult>;

  /**
   * Get state statistics
   */
  getStatistics(): StateStatistics;

  /**
   * Subscribe to state events
   */
  on(event: 'changed', listener: (event: StateChangeEvent) => void): void;
  on(event: 'snapshot', listener: (snapshot: StateSnapshot) => void): void;
  on(event: 'restored', listener: (snapshot: StateSnapshot) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;

  /**
   * Unsubscribe from state events
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  off(event: string, listener: Function): void;
}>;

/**
 * State statistics
 */
export interface StateStatistics {
  /** Total state size (bytes) */
  totalSize: number;
  /** Number of state paths */
  pathCount: number;
  /** Number of namespaces */
  namespaceCount: number;
  /** Number of watchers */
  watcherCount: number;
  /** Number of snapshots */
  snapshotCount: number;
  /** State operations per second */
  operationsPerSecond: number;
  /** Memory usage (bytes) */
  memoryUsage: number;
  /** Persistence statistics */
  persistence: {
    lastSave: number;
    lastLoad: number;
    saveCount: number;
    loadCount: number;
    errorCount: number;
  };
  /** Namespace statistics */
  namespaces: Record<
    string,
    {
      size: number;
      pathCount: number;
      watcherCount: number;
      operationCount: number;
    }
  >;
}

/**
 * Plugin state interface
 */
export interface PluginState {
  /** Plugin instance */
  plugin: Plugin;
  /** Plugin configuration */
  config: ConfigObject;
  /** Plugin runtime data */
  runtime: {
    startTime: number;
    uptime: number;
    memoryUsage: number;
    cpuTime: number;
    eventCount: number;
    errorCount: number;
  };
  /** Plugin custom state */
  custom: ConfigObject;
}

/**
 * Kernel state interface
 */
export interface KernelStateData {
  /** Kernel information */
  info: {
    id: string;
    name: string;
    version: string;
    startTime: number;
    uptime: number;
  };
  /** Kernel configuration */
  config: ConfigObject;
  /** Plugin states */
  plugins: Record<string, PluginState>;
  /** System metrics */
  metrics: {
    memory: Record<string, number>;
    cpu: Record<string, number>;
    events: Record<string, number>;
    performance: Record<string, number>;
  };
  /** Custom kernel state */
  custom: ConfigObject;
}

/**
 * State path utilities
 */
export class StatePath {
  /**
   * Join path segments
   */
  static join(...segments: string[]): StatePathString {
    return segments.filter(Boolean).join('.') as StatePathString;
  }

  /**
   * Split path into segments
   */
  static split(path: StatePathString): string[] {
    return path.split('.').filter(Boolean);
  }

  /**
   * Get parent path
   */
  static parent(path: StatePathString): StatePathString {
    const segments = StatePath.split(path);
    return segments.slice(0, -1).join('.') as StatePathString;
  }

  /**
   * Get path basename
   */
  static basename(path: StatePathString): string {
    const segments = StatePath.split(path);
    return segments[segments.length - 1] || '';
  }

  /**
   * Check if path is child of parent
   */
  static isChild(path: StatePathString, parent: StatePathString): boolean {
    return path.startsWith(parent + '.') || path === parent;
  }

  /**
   * Normalize path
   */
  static normalize(path: string): StatePathString {
    return StatePath.split(path as StatePathString).join('.') as StatePathString;
  }

  /**
   * Check if path is valid
   */
  static isValid(path: string): path is StatePathString {
    return typeof path === 'string' && path.length > 0 && !/[^a-zA-Z0-9._-]/.test(path);
  }
}

/**
 * Type guards
 */
export function isStateChangeEvent(obj: unknown): obj is StateChangeEvent {
  if (!isObject(obj) || !isNotNullish(obj)) return false;
  const event = obj as Record<string, unknown>;
  return (
    'type' in event && event.type === 'state:changed' && 'data' in event && isObject(event.data)
  );
}

export function isStateSnapshot(obj: unknown): obj is StateSnapshot {
  if (!isObject(obj) || !isNotNullish(obj)) return false;
  const snapshot = obj as Record<string, unknown>;
  return (
    'id' in snapshot &&
    'timestamp' in snapshot &&
    'data' in snapshot &&
    'version' in snapshot &&
    isString(snapshot.id) &&
    isNumber(snapshot.timestamp) &&
    isObject(snapshot.data) &&
    isString(snapshot.version)
  );
}

export function isStateDiff(obj: unknown): obj is StateDiff {
  if (!isObject(obj) || !isNotNullish(obj)) return false;
  const diff = obj as Record<string, unknown>;
  return (
    'id' in diff &&
    'fromSnapshot' in diff &&
    'toSnapshot' in diff &&
    'entries' in diff &&
    isString(diff.id) &&
    isArray(diff.entries)
  );
}

/**
 * Factory functions for branded types
 */
export function createStateSnapshotId(id: string): StateSnapshotId {
  return id as StateSnapshotId;
}

export function createStateDiffId(id: string): StateDiffId {
  return id as StateDiffId;
}

export function createStateWatcherId(id: string): StateWatcherId {
  return id as StateWatcherId;
}

export function createStateNamespace(name: string): StateNamespace {
  return name as StateNamespace;
}
