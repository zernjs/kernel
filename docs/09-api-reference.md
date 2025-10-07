# API Reference

> **Complete reference documentation for all public APIs**

This document provides a comprehensive reference for all public APIs exported by Zern Kernel.

---

## 📦 Core Module (`@zern/kernel`)

### Factory Functions

#### `createKernel()`

Creates a new kernel builder.

```typescript
function createKernel(): KernelBuilder<never>;
```

**Returns:** A `KernelBuilder` instance

**Example:**

```typescript
const kernel = await createKernel().use(mathPlugin).start();
```

#### `plugin(name, version)`

Creates a new plugin builder.

```typescript
function plugin<TName extends string>(
  name: TName,
  version: string
): PluginBuilder<TName, unknown, Record<string, never>, Record<string, never>>;
```

**Parameters:**

- `name` - Plugin name (must be unique, 2-50 chars)
- `version` - Semantic version (e.g., "1.0.0")

**Returns:** A `PluginBuilder` instance

**Example:**

```typescript
const mathPlugin = plugin('math', '1.0.0').setup(() => ({ add: (a, b) => a + b }));
```

#### `createStore(initialState, options?)`

Creates a reactive store with automatic change tracking.

```typescript
function createStore<TStore extends Record<string, any>>(
  initialState: TStore,
  options?: StoreOptions
): Store<TStore>;
```

**Parameters:**

- `initialState` - Initial state object
- `options` - Optional configuration (history, maxHistory, deep)

**Returns:** A reactive `Store` instance

**Example:**

```typescript
const store = createStore({ count: 0 }, { history: true });
store.watch('count', change => console.log(change));
```

**Note:** When using `.store()` in plugins, stores are automatically reactive.

---

## 🔧 Kernel API

### `KernelBuilder<U>`

Fluent API for building kernels.

#### `.use(plugin)`

Registers a plugin.

```typescript
use<P extends BuiltPlugin<string, unknown, unknown>>(
  plugin: P
): KernelBuilder<U | P>;
```

#### `.config(config)`

Configures the kernel.

```typescript
config(config: Partial<KernelConfig>): KernelBuilder<U>;
```

#### `.proxy(target, config)` / `.proxy('**', config)`

Registers kernel-level proxies for plugins. Supports two modes:

**Single Plugin Proxy:**

```typescript
proxy<TTargetName extends string, TTargetApi>(
  target: BuiltPlugin<TTargetName, TTargetApi, unknown, unknown>,
  config: ProxyConfig<TTargetApi>
): KernelBuilder<U>;
```

**Global Proxy:**

```typescript
proxy(target: '**', config: ProxyConfig<any>): KernelBuilder<U>;
```

**Example:**

```typescript
const kernel = await createKernel()
  .use(mathPlugin)
  .use(apiPlugin)
  // Proxy specific plugin
  .proxy(mathPlugin, {
    before: ctx => console.log(`Intercepting ${ctx.method}`),
  })
  // Global proxy for all plugins
  .proxy('**', {
    priority: 100,
    before: ctx => console.log(`Global: ${ctx.pluginName}.${ctx.method}`),
  })
  .start();
```

See [Proxy System](./12-proxy-system.md#kernel-level-proxies) for details.

#### `.build()`

Builds the kernel without initializing.

```typescript
build(): BuiltKernel<PluginsMap<U>>;
```

#### `.start()`

Builds and initializes the kernel.

```typescript
start(): Promise<Kernel<PluginsMap<U>>>;
```

### `Kernel<TPlugins>`

Initialized kernel instance.

#### `.get(name)`

Gets a plugin API by name with full access to `$meta` and `$store`.

```typescript
get<TName extends keyof TPlugins>(name: TName): TPlugins[TName];
```

**Returns:** Plugin API combined with:

- **API methods** - All plugin methods (fully typed)
- **`$meta`** - Plugin metadata (name, version, and custom metadata)
- **`$store`** - Complete reactive store with all Store methods

**Example:**

```typescript
const logger = kernel.get('logger');

// ✅ Use API methods
logger.log('Hello!');
logger.error('Something went wrong');

// ✅ Access metadata
console.log(logger.$meta.name); // "logger"
console.log(logger.$meta.version); // "1.0.0"
console.log(logger.$meta.author); // Custom metadata (if defined)

// ✅ Access and watch store
console.log(logger.$store.logCount);
logger.$store.watch('logCount', change => {
  console.log(`Logs: ${change.newValue}`);
});

// ✅ Use Store methods
logger.$store.batch(() => {
  logger.$store.logCount++;
  logger.$store.errorCount++;
});
```

**What's available:**

| Property            | Type       | Description                                 |
| ------------------- | ---------- | ------------------------------------------- |
| API methods         | `TApi`     | All plugin methods with full type safety    |
| `$meta.name`        | `string`   | Plugin name                                 |
| `$meta.version`     | `string`   | Plugin version                              |
| `$meta.*`           | `any`      | Custom metadata (defined via `.metadata()`) |
| `$store.*`          | `TStore`   | Reactive state properties                   |
| `$store.watch()`    | `Function` | Watch property changes                      |
| `$store.watchAll()` | `Function` | Watch all changes                           |
| `$store.batch()`    | `Function` | Batch multiple updates                      |
| `$store.computed()` | `Function` | Create computed values                      |
| ...                 | ...        | All other Store methods                     |

See [Store System](./13-store-system.md) for complete `$store` API documentation.

**Throws:** `PluginNotFoundError` if plugin doesn't exist

#### `.shutdown()`

Gracefully shuts down the kernel.

```typescript
shutdown(): Promise<void>;
```

#### Properties

```typescript
readonly id: KernelId;
readonly config: KernelConfig;
```

---

## 🔌 Plugin API

### `PluginBuilder<TName, TApi, TDeps, TExtMap>`

Fluent API for building plugins.

#### `.setup(fn)`

Defines the plugin API.

```typescript
setup<TNewApi>(
  fn: (ctx: PluginSetupContext<TDeps>) => TNewApi
): BuiltPlugin<TName, TNewApi, TExtMap>;
```

#### `.depends(plugin, versionRange?)`

Adds a dependency.

```typescript
depends<TDepName extends string, TDepApi>(
  plugin: BuiltPlugin<TDepName, TDepApi>,
  versionRange?: string
): PluginBuilder<TName, TApi, TDeps & Record<TDepName, TDepApi>, TExtMap>;
```

#### `.extend(target, fn)`

Extends another plugin's API.

```typescript
extend<TTargetName extends string, TTargetApi, TExt extends object>(
  target: BuiltPlugin<TTargetName, TTargetApi, unknown>,
  fn: (api: TTargetApi) => TExt
): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>>;
```

#### `.proxy(config)` / `.proxy(target, config)` / `.proxy('*', config)` / `.proxy('**', config)`

Proxies/intercepts methods on plugins. Supports **4 modes**:

**1. Self-Proxy (no target):**

```typescript
proxy(config: ProxyConfig<TApi>): PluginBuilder<TName, TApi, TDeps, TExtMap>;
```

**2. Single Plugin Proxy:**

```typescript
proxy<TTargetName extends string, TTargetApi>(
  target: BuiltPlugin<TTargetName, TTargetApi, unknown, unknown>,
  config: ProxyConfig<TTargetApi>
): PluginBuilder<TName, TApi, TDeps, TExtMap>;
```

**3. Dependencies Proxy (`'*'`):**

```typescript
proxy(target: '*', config: ProxyConfig<any>): PluginBuilder<TName, TApi, TDeps, TExtMap>;
```

**4. Global Proxy (`'**'`):\*\*

```typescript
proxy(target: '**', config: ProxyConfig<any>): PluginBuilder<TName, TApi, TDeps, TExtMap>;
```

**Examples:**

```typescript
// Self-proxy
.proxy({ methods: 'add', before: ctx => console.log('self-proxy') })

// Single plugin proxy (requires .depends())
.depends(mathPlugin, '^1.0.0')
.proxy(mathPlugin, { methods: 'add', before: ctx => console.log('single') })

// All dependencies proxy
.depends(mathPlugin, '^1.0.0')
.depends(apiPlugin, '^1.0.0')
.proxy('*', { before: ctx => console.log('all deps') })

// Global proxy (all plugins in kernel)
.proxy('**', { before: ctx => console.log('global') })
```

See [Proxy System](./12-proxy-system.md) for complete documentation.

#### `.config(options)`

Configures plugin-specific settings including error handling.

```typescript
config(
  config: { errors?: ErrorConfig } & Record<string, unknown>
): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore>;
```

**Parameters:**

- `config` - Configuration object with `errors` and custom properties

**Returns:** PluginBuilder with same types

**Example:**

```typescript
const mathPlugin = plugin('math', '1.0.0')
  .config({
    errors: {
      showSolutions: true,
      severity: ErrorSeverity.WARN,
    },
    precision: 2,
    enableLogging: true,
  })
  .setup(() => ({ add: (a, b) => a + b }));
```

See [Error Handling](./14-error-handling.md) for complete error configuration options.

#### `.metadata(data)`

Attaches custom metadata to the plugin.

```typescript
metadata<TNewMetadata extends Record<string, unknown>>(
  metadata: TNewMetadata
): PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata>;
```

**Parameters:**

- `metadata` - Object with custom metadata (any key-value pairs)

**Returns:** PluginBuilder with updated metadata type

**Example:**

```typescript
const dbPlugin = plugin('database', '1.0.0')
  .metadata({
    author: 'Zern Team',
    category: 'data',
    connectionString: 'postgresql://localhost:5432/mydb',
    maxConnections: 10,
  })
  .setup(() => ({
    /* API */
  }));
```

**Accessing Metadata:**

Metadata is accessible via `$meta` in lifecycle hooks:

```typescript
.onInit(({ plugins }) => {
  console.log(plugins.database.$meta.author); // "Zern Team"
  console.log(plugins.database.$meta.connectionString); // "postgresql://..."
  console.log(plugins.database.$meta.name); // "database" (auto-included)
  console.log(plugins.database.$meta.version); // Version object (auto-included)
});
```

#### `.onInit(hook)`

Registers an initialization hook (called before `setup()`).

```typescript
onInit(hook: (context: LifecycleHookContext) => void | Promise<void>): PluginBuilder<TName, TApi, TDeps, TExtMap>;
```

#### `.onReady(hook)`

Registers a ready hook (called after plugin is fully initialized).

```typescript
onReady(hook: (context: LifecycleHookContext) => void | Promise<void>): PluginBuilder<TName, TApi, TDeps, TExtMap>;
```

#### `.onShutdown(hook)`

Registers a shutdown hook (called during kernel shutdown).

```typescript
onShutdown(hook: (context: LifecycleHookContext) => void | Promise<void>): PluginBuilder<TName, TApi, TDeps, TExtMap>;
```

#### `.onError(hook)`

Registers an error hook (called when plugin initialization fails).

```typescript
onError(hook: (error: Error, context: LifecycleHookContext) => void | Promise<void>): PluginBuilder<TName, TApi, TDeps, TExtMap>;
```

### `BuiltPlugin<TName, TApi, TExtMap>`

Built plugin (ready for kernel registration).

#### Properties

```typescript
readonly id: PluginId;
readonly name: TName;
readonly version: Version;
readonly dependencies: readonly PluginDependency[];
readonly extensions: readonly PluginExtension[];
readonly proxies: readonly ProxyMetadata[];
readonly setupFn: (ctx: PluginSetupContext<Record<string, unknown>>) => TApi;
```

---

## 🎯 Direct Exports API

### `createDirectExports(pluginName, methodSignatures)`

Creates direct method exports.

```typescript
function createDirectExports<
  TPluginName extends string,
  TMethods extends Record<string, (...args: any[]) => any>,
>(pluginName: TPluginName, methodSignatures: TMethods): TMethods;
```

**Parameters:**

- `pluginName` - Plugin name (must match plugin ID)
- `methodSignatures` - Object with method signatures (values ignored, only types matter)

**Returns:** Object with runtime-bound methods

**Example:**

```typescript
export const { add, multiply } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  multiply: (a: number, b: number): number => 0,
});
```

### `createDirectMethod(pluginName, methodName)`

Creates a single direct method export.

```typescript
function createDirectMethod<TPluginName extends string, TMethodName extends string>(
  pluginName: TPluginName,
  methodName: TMethodName
): (...args: any[]) => any;
```

**Example:**

```typescript
export const add = createDirectMethod('math', 'add');
```

### `setGlobalKernel(kernel)`

Registers a kernel globally.

```typescript
function setGlobalKernel<TPlugins>(kernel: Kernel<TPlugins>): void;
```

### `getGlobalKernel()`

Gets the global kernel.

```typescript
function getGlobalKernel(): any;
```

**Throws:** `KernelInitializationError` if kernel not initialized

---

## 🛠️ Proxy API

### Proxy Configuration

#### `ProxyConfig<TStore>`

Configuration for method proxying. Store is accessible via `ctx.store` in all interceptors.

```typescript
interface ProxyConfig<TStore = any> {
  // Method selection
  include?: MethodPattern[];
  exclude?: MethodPattern[];

  // Interceptors (all have access to ctx.store)
  before?: ProxyBefore<any, TStore>;
  after?: ProxyAfter<any, TStore>;
  onError?: ProxyError<any, TStore>;
  around?: ProxyAround<any, TStore>;

  // Advanced options
  priority?: number;
  condition?: (ctx: ProxyContext<any>) => boolean;
  group?: string;
}
```

#### `ProxyContext<TMethod, TStore, TPlugins>`

Context provided to proxy interceptors with complete type safety.

```typescript
interface ProxyContext<TMethod, TStore, TPlugins> {
  // Basic information
  readonly pluginName: string; // Plugin name being proxied
  readonly method: string; // Method name being called
  readonly args: Parameters<TMethod>; // Method arguments (fully typed)

  // Store access
  readonly store: Store<TStore>; // YOUR plugin's store (full Store object)
  readonly plugins: TPlugins; // Target plugin(s) with $store and $meta

  // Helper methods
  skip: () => void; // Skip method execution
  replace: (result: Awaited<ReturnType<TMethod>>) => void; // Replace result
  modifyArgs: (...args: Parameters<TMethod>) => void; // Modify arguments
}
```

**Store Access:**

- `ctx.store` - Your plugin's reactive store with all Store methods
- `ctx.plugins.<name>` - Target plugin's API
- `ctx.plugins.<name>.$store` - Target plugin's reactive store
- `ctx.plugins.<name>.$meta` - Target plugin's metadata (name, version, custom)

**Example:**

```typescript
.proxy(mathPlugin, {
  before: ctx => {
    // Your store
    ctx.store.logCount++;
    ctx.store.watch('logCount', change => { ... });

    // Target plugin
    ctx.plugins.math.$store.callCount++;
    ctx.plugins.math.$store.watch('callCount', change => { ... });
    console.log(ctx.plugins.math.$meta.name); // "math"
    console.log(ctx.plugins.math.$meta.version); // "1.0.0"
  },
})
```

#### Interceptor Types

```typescript
type ProxyBefore<TMethod> = (ctx: ProxyContext<TMethod>) => void | Promise<void>;

type ProxyAfter<TMethod> = (
  result: Awaited<ReturnType<TMethod>>,
  ctx: ProxyContext<TMethod>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

type ProxyError<TMethod> = (
  error: Error,
  ctx: ProxyContext<TMethod>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

type ProxyAround<TMethod> = (
  ctx: ProxyContext<TMethod>,
  next: () => Promise<Awaited<ReturnType<TMethod>>>
) => Promise<Awaited<ReturnType<TMethod>>>;
```

See [Proxy System](./12-proxy-system.md) for complete documentation and examples.

---

## 💾 Store API

### `createStore<T>(initialState: T, options?: StoreOptions): Store<T>`

Creates a reactive store with automatic change tracking.

```typescript
import { createStore } from '@zern/kernel';

const store = createStore({ count: 0, items: [] }, { history: true, maxHistory: 50 });

// Store is automatically reactive
store.watch('count', change => {
  console.log(`Count: ${change.oldValue} → ${change.newValue}`);
});

store.count++; // Triggers watcher
```

**Note:** When using `.store()` in plugins, the store is automatically created as reactive. You only need `createStore()` for external usage.

### Store Methods

#### `watch<K>(key: K, callback: WatchCallback): () => void`

Watch a specific property for changes.

```typescript
const unwatch = store.watch('count', change => {
  console.log(change.oldValue, change.newValue);
});

unwatch(); // Stop watching
```

#### `watchAll(callback: WatchAllCallback): () => void`

Watch all property changes.

```typescript
store.watchAll(change => {
  console.log(`${change.key} changed`);
});
```

#### `watchBatch(callback: WatchBatchCallback): () => void`

Watch batched changes (fires once per batch).

```typescript
store.watchBatch(changes => {
  console.log(`${changes.length} properties changed`);
});
```

#### `batch(fn: () => void): void`

Group multiple changes into a single notification.

```typescript
store.batch(() => {
  store.count++;
  store.items.push(1);
  store.total++;
}); // All watchers notified once
```

#### `transaction<T>(fn: () => Promise<T>): Promise<T>`

Execute changes in a transaction (commit on success, rollback on error).

```typescript
await store.transaction(async () => {
  store.count = 100;
  await saveToDatabase();
  // If error, count is rolled back
});
```

#### `computed<T>(selector: (store) => T): ComputedValue<T>`

Create a memoized computed value.

```typescript
const doubled = store.computed(s => s.count * 2);
console.log(doubled.value); // Auto-memoized
```

#### `getMetrics(): StoreMetrics | undefined`

Get performance metrics (only available if `enableMetrics: true`).

```typescript
const store = createStore({ count: 0 }, { enableMetrics: true });
const metrics = store.getMetrics();

console.log('Active watchers:', metrics?.activeWatchers);
console.log('Total changes:', metrics?.totalChanges);
```

#### `redo(): void`

Redo the last undone change (only available if `history: true`).

```typescript
const store = createStore({ count: 0 }, { history: true });

store.count = 5;
store.undo(); // count = 0
store.redo(); // count = 5
```

### Store Types

```typescript
interface StoreChange<T> {
  key: string;
  oldValue: T;
  newValue: T;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface StoreOptions {
  // History
  history?: boolean; // Enable history tracking (default: false)
  maxHistory?: number; // Max history entries (default: 50)

  // Performance
  maxWatchers?: number; // Max total watchers (default: 1000)
  maxWatchersPerKey?: number; // Max watchers per key (default: 100)
  warnOnHighWatcherCount?: boolean; // Warn on high count (default: true)
  warnThreshold?: number; // Warning threshold (default: 100)

  // Metrics
  enableMetrics?: boolean; // Enable performance metrics (default: false)

  // Transaction
  cloneStrategy?: CloneStrategy; // Clone strategy (default: 'structured')

  // Future
  deep?: boolean; // Deep watching (not yet implemented)
}

interface StoreMetrics {
  totalChanges: number;
  activeWatchers: number;
  watchersByType: {
    key: number;
    all: number;
    batch: number;
    computed: number;
  };
  computedValues: number;
  historySize: number;
  avgNotificationTime: number;
  peakWatchers: number;
}

type CloneStrategy = 'structured' | 'manual';

type Store<T> = T & StoreMethods<T>;
```

**Performance Notes:**

- `structured` clone is ~10x faster than `manual` (requires Node 17+ or modern browsers)
- Indexed watchers provide O(1) lookup vs O(n) without indexing
- Computed values only recalculate when dependencies change
- Circular buffer provides O(1) history operations

See [Store System](./13-store-system.md) for complete documentation and examples.

---

## 📊 Types

### Core Types

#### `PluginId`

Branded type for plugin identifiers.

```typescript
type PluginId = string & { readonly __brand: 'PluginId' };
```

#### `KernelId`

Branded type for kernel identifiers.

```typescript
type KernelId = string & { readonly __brand: 'KernelId' };
```

#### `Version`

Branded type for semantic versions.

```typescript
type Version = string & { readonly __brand: 'Version' };
```

#### `Result<T, E>`

Result type for functional error handling.

```typescript
type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };
```

### Configuration Types

#### `KernelConfig`

Kernel configuration options.

```typescript
interface KernelConfig {
  readonly autoGlobal?: boolean;
  readonly strictVersioning?: boolean;
  readonly circularDependencies?: boolean;
  readonly initializationTimeout?: number;
  readonly extensionsEnabled?: boolean;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
  readonly errors?: ErrorConfig;
}
```

**Properties:**

- `autoGlobal` - Automatically register kernel globally (default: `true`)
- `strictVersioning` - Enforce strict version matching (default: `true`)
- `circularDependencies` - Allow circular dependencies (default: `false`)
- `initializationTimeout` - Max initialization time in milliseconds (default: `30000`)
- `extensionsEnabled` - Enable plugin extensions (default: `true`)
- `logLevel` - Logging verbosity level (default: `'info'`)
- `errors` - Error handling configuration (see [Error Handling](./14-error-handling.md))

#### `PluginState`

Plugin lifecycle states.

```typescript
enum PluginState {
  UNLOADED = 'UNLOADED',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  ERROR = 'ERROR',
}
```

### Metadata Types

#### `PluginMetadata`

Complete plugin metadata.

```typescript
interface PluginMetadata {
  readonly id: PluginId;
  readonly name: string;
  readonly version: Version;
  readonly state: PluginState;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions: readonly PluginExtension[];
  readonly proxies: readonly ProxyMetadata[];
}
```

#### `PluginDependency`

Plugin dependency specification.

```typescript
interface PluginDependency {
  readonly pluginId: PluginId;
  readonly versionRange: string;
}
```

#### `PluginExtension`

Plugin extension specification.

```typescript
interface PluginExtension {
  readonly targetPluginId: PluginId;
  readonly extensionFn: (api: unknown) => unknown;
}
```

---

## ⚠️ Error Handling

### `ZernError`

Base error class with rich context and solutions.

```typescript
abstract class ZernError extends Error {
  abstract readonly code: string;

  severity: ErrorSeverity;
  context: ErrorContext;
  solutions: ErrorSolution[];
  timestamp: Date;
  cause?: Error;

  constructor(message: string, options?: ZernErrorOptions);
  toJSON(): Record<string, unknown>;
}
```

**Properties:**

- `code` - Unique error code (e.g., `'PLUGIN_NOT_FOUND'`)
- `severity` - Error severity (`INFO`, `WARN`, `ERROR`, `FATAL`)
- `context` - Additional error context (file, line, plugin, method, etc.)
- `solutions` - Array of actionable solutions
- `timestamp` - When the error occurred
- `cause` - Original error if wrapped

### `ErrorSeverity`

Error severity levels.

```typescript
enum ErrorSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}
```

### `ErrorContext`

Additional error context.

```typescript
interface ErrorContext {
  plugin?: string;
  method?: string;
  file?: string;
  line?: number;
  column?: number;
  timestamp?: Date;
  [key: string]: unknown; // Custom context
}
```

### `ErrorSolution`

Actionable solution for fixing an error.

```typescript
interface ErrorSolution {
  title: string;
  description: string;
  code?: string;
}
```

### `ErrorConfig`

Error handling configuration.

```typescript
interface ErrorConfig {
  captureStackTrace?: boolean;
  stackTraceLimit?: number;
  filterInternalFrames?: boolean;
  enableColors?: boolean;
  showContext?: boolean;
  showSolutions?: boolean;
  showTimestamp?: boolean;
  severity?: ErrorSeverity;
}
```

### `ErrorHandler`

Processes and displays errors.

```typescript
class ErrorHandler {
  constructor(config?: Partial<ErrorConfig>);

  handle(error: Error | ZernError): void;
  configure(config: Partial<ErrorConfig>): void;
}
```

### Plugin Errors

#### `PluginError`

Base plugin error.

```typescript
class PluginError extends ZernError {
  readonly code = 'PLUGIN_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

#### `PluginNotFoundError`

Plugin not found in registry.

```typescript
class PluginNotFoundError extends PluginError {
  readonly code = 'PLUGIN_NOT_FOUND';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

#### `PluginLoadError`

Plugin failed to load.

```typescript
class PluginLoadError extends PluginError {
  readonly code = 'PLUGIN_LOAD_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

#### `PluginDependencyError`

Plugin dependency error.

```typescript
class PluginDependencyError extends PluginError {
  readonly code = 'PLUGIN_DEPENDENCY_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

### Kernel Errors

#### `KernelError`

Base kernel error.

```typescript
class KernelError extends ZernError {
  readonly code = 'KERNEL_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

#### `KernelInitializationError`

Kernel initialization failed.

```typescript
class KernelInitializationError extends KernelError {
  readonly code = 'KERNEL_INITIALIZATION_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

#### `CircularDependencyError`

Circular dependency detected.

```typescript
class CircularDependencyError extends KernelError {
  readonly code = 'CIRCULAR_DEPENDENCY_ERROR';
  constructor(context?: ErrorContext & { cycle?: string[] }, options?: ZernErrorOptions);
}
```

### Version Errors

#### `VersionError`

Base version error.

```typescript
class VersionError extends ZernError {
  readonly code = 'VERSION_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

#### `VersionMismatchError`

Version mismatch error.

```typescript
class VersionMismatchError extends VersionError {
  readonly code = 'VERSION_MISMATCH_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

### Generic Errors

#### `ValidationError`

Validation failures.

```typescript
class ValidationError extends ZernError {
  readonly code = 'VALIDATION_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

#### `ConfigurationError`

Configuration problems.

```typescript
class ConfigurationError extends ZernError {
  readonly code = 'CONFIGURATION_ERROR';
  constructor(context?: ErrorContext, options?: ZernErrorOptions);
}
```

#### `GenericError`

Generic catch-all error.

```typescript
class GenericError extends ZernError {
  readonly code = 'GENERIC_ERROR';
  constructor(message: string, options?: ZernErrorOptions);
}
```

### Helper Functions

#### `solution(title, description, code?)`

Create an error solution.

```typescript
function solution(title: string, description: string, code?: string): ErrorSolution;
```

#### `createError(ErrorClass, context?, overrides?)`

Create an error instance.

```typescript
function createError<T extends ZernError>(
  ErrorClass: new (context?: ErrorContext) => T,
  context?: ErrorContext,
  overrides?: {
    message?: string;
    severity?: ErrorSeverity;
    solutions?: ErrorSolution[];
    cause?: Error;
  }
): T;
```

#### `throwError(ErrorClass, context?, overrides?)`

Create and throw an error.

```typescript
function throwError<T extends ZernError>(
  ErrorClass: new (context?: ErrorContext) => T,
  context?: ErrorContext,
  overrides?: {
    message?: string;
    severity?: ErrorSeverity;
    solutions?: ErrorSolution[];
    cause?: Error;
  }
): never;
```

#### `matchError(error)`

Pattern match on errors.

```typescript
function matchError(error: Error | ZernError): ErrorMatcher;

class ErrorMatcher<T = unknown> {
  on<E extends ZernError>(
    ErrorClass: new (...args: unknown[]) => E,
    callback: (error: E) => T
  ): ErrorMatcher<T>;

  whenSeverity(severity: ErrorSeverity, callback: (error: ZernError) => T): ErrorMatcher<T>;

  otherwise(callback: (error: Error | ZernError) => T): void;
}
```

#### `developmentConfig()`

Get development error configuration.

```typescript
function developmentConfig(): ErrorConfig;
```

#### `productionConfig()`

Get production error configuration.

```typescript
function productionConfig(): ErrorConfig;
```

**For complete error handling documentation, see [Error Handling](./14-error-handling.md).**

---

## ⏱️ Lifecycle Hooks

### `LifecycleHookContext`

Context provided to lifecycle hooks.

```typescript
interface LifecycleHookContext<
  TDepsWithMeta = Record<string, unknown>,
  TStore extends Record<string, any> = Record<string, never>,
  TApi = unknown,
> {
  readonly pluginName: string;
  readonly pluginId: PluginId;
  readonly kernel: KernelContext;
  readonly plugins: TDepsWithMeta;
  readonly store: Store<TStore>;
  readonly api?: TApi;
  readonly phase: 'init' | 'setup' | 'ready' | 'shutdown' | 'runtime';
  readonly method?: string;
}
```

**Properties:**

- `pluginName` - The plugin's name
- `pluginId` - The plugin's unique ID
- `kernel` - Kernel context for accessing other plugins
- `plugins` - Type-safe dependencies with API and metadata access
- `store` - Reactive store for shared state
- `api` - Plugin's own API (available in `onReady` and `onShutdown`)
- `phase` - Current execution phase (`init`, `setup`, `ready`, `shutdown`, `runtime`)
- `method` - Method name (present when `phase === 'runtime'`)

**Accessing Dependencies:**

Dependencies provide both their API and metadata via `$meta`:

```typescript
const analyticsPlugin = plugin('analytics', '1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .onInit(({ plugins }) => {
    // ✅ Access API
    plugins.database.connect();

    // ✅ Access metadata
    console.log(plugins.database.$meta.connectionString);
    console.log(plugins.database.$meta.name); // "database"
    console.log(plugins.database.$meta.version); // Version object
  })
  .setup(() => ({
    /* API */
  }));
```

### `PluginLifecycleHooks`

Available lifecycle hooks.

```typescript
interface PluginLifecycleHooks {
  readonly onInit?: (context: LifecycleHookContext) => void | Promise<void>;
  readonly onReady?: (context: LifecycleHookContext) => void | Promise<void>;
  readonly onShutdown?: (context: LifecycleHookContext) => void | Promise<void>;
  readonly onError?: (error: Error, context: LifecycleHookContext) => void | Promise<void>;
}
```

**Hooks:**

- `onInit` - Called before plugin `setup()` function
- `onReady` - Called after plugin is fully initialized
- `onShutdown` - Called during kernel shutdown
- `onError` - Called when plugin initialization fails

**Example:**

```typescript
const plugin = plugin('example', '1.0.0')
  .onInit(({ pluginName }) => {
    console.log(`[${pluginName}] Initializing...`);
  })
  .onReady(({ pluginName, kernel }) => {
    console.log(`[${pluginName}] Ready!`);
  })
  .onShutdown(({ pluginName }) => {
    console.log(`[${pluginName}] Shutting down...`);
  })
  .onError((error, { pluginName }) => {
    console.error(`[${pluginName}] Error:`, error);
  })
  .setup(() => ({
    /* API */
  }));
```

See [Lifecycle Hooks](./11-lifecycle-hooks.md) for detailed documentation.

---

## 🔧 Utility Functions

### Version Utilities

```typescript
function parseVersion(version: Version): SemanticVersion;
function compareVersions(a: Version, b: Version): number;
function satisfiesVersion(version: Version, range: string): boolean;
function isValidVersionRange(range: string): boolean;
```

### Validation Utilities

```typescript
function isValidPluginName(name: string): boolean;
function validatePluginName(name: string): void;
function isValidKernelId(id: string): boolean;
function validateKernelId(id: string): void;
function isNonEmptyString(value: unknown): value is string;
function isObject(value: unknown): value is Record<string, unknown>;
function isFunction(value: unknown): value is Function;
```

### Type Guards

```typescript
function isPluginState(value: unknown): value is PluginState;
function isPluginDependency(value: unknown): value is PluginDependency;
function isPluginExtension(value: unknown): value is PluginExtension;
function isPluginMetadata(value: unknown): value is PluginMetadata;
function isBuiltPlugin(value: unknown): value is BuiltPlugin<string, unknown>;
function isResult<T, E>(value: unknown): value is Result<T, E>;
```

### API Helpers

```typescript
function bindMethods<T extends object>(
  instance: T,
  excludeMethods?: readonly string[]
): BoundMethods<T>;

function combineImplementations<T = Record<string, AnyFunction>>(
  ...implementations: readonly object[]
): T;

function createAPI<T>(implementations: readonly object[], overrides?: Partial<T>): T;

function createAPIFactory<T, TConfig = Record<string, unknown>>(
  implementations: readonly (() => object)[]
): (config?: TConfig) => T;

function extendAPI<TBase, TExt>(baseAPI: TBase, extensions: TExt): TBase & TExt;

function pickMethods<T extends object, K extends keyof MethodsOnly<T>>(
  instance: T,
  methodNames: readonly K[]
): Pick<MethodsOnly<T>, K>;
```

### Result Utilities

```typescript
function success<T>(data: T): Result<T, never>;
function failure<E>(error: E): Result<never, E>;
function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T };
function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E };
function mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E>;
function chainResult<T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E>;
function collectResults<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E>;
```

### Factory Functions

```typescript
function createPluginId(value: string): PluginId;
function createKernelId(value: string): KernelId;
function createVersion(value: string): Version;
function createPluginRegistry(): PluginRegistry;
function createDependencyResolver(): DependencyResolver;
function createPluginContainer(): PluginContainer;
function createLifecycleManager(): LifecycleManager;
function createExtensionManager(): ExtensionManager;
```

---

## 📚 Next Steps

Now that you have the complete API reference, proceed to:

**[Best Practices →](./10-best-practices.md)**  
Learn recommended patterns, guidelines, and common pitfalls to avoid.

---

[← Back to Index](./README.md) | [Next: Best Practices →](./10-best-practices.md)
