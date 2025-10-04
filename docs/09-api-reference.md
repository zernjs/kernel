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

#### `.withConfig(config)`

Configures the kernel.

```typescript
withConfig(config: Partial<KernelConfig>): KernelBuilder<U>;
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
    before: ctx => console.log(`Global: ${ctx.plugin}.${ctx.method}`),
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

Gets a plugin API by name.

```typescript
get<TName extends keyof TPlugins>(name: TName): TPlugins[TName];
```

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

#### `ProxyContext<TMethod>`

Context provided to proxy interceptors.

```typescript
interface ProxyContext<TMethod extends (...args: any[]) => any> {
  readonly plugin: string;
  readonly method: string;
  readonly args: Parameters<TMethod>;

  data: Record<string, any>;

  skip: () => void;
  replace: (result: Awaited<ReturnType<TMethod>>) => void;
  modifyArgs: (...args: Parameters<TMethod>) => void;
}
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
}
```

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

## ⚠️ Error Classes

### `ZernError`

Base error class.

```typescript
abstract class ZernError extends Error {
  abstract readonly code: string;
  readonly cause?: Error;
}
```

### Plugin Errors

#### `PluginError`

Base plugin error.

```typescript
class PluginError extends ZernError {
  readonly code: string = 'PLUGIN_ERROR';
}
```

#### `PluginNotFoundError`

Plugin not found in registry.

```typescript
class PluginNotFoundError extends PluginError {
  readonly code = 'PLUGIN_NOT_FOUND';
  constructor(pluginId: string);
}
```

#### `PluginLoadError`

Plugin failed to load.

```typescript
class PluginLoadError extends PluginError {
  readonly code = 'PLUGIN_LOAD_ERROR';
  constructor(pluginId: string, cause?: Error);
}
```

#### `PluginDependencyError`

Plugin dependency error.

```typescript
class PluginDependencyError extends PluginError {
  readonly code = 'PLUGIN_DEPENDENCY_ERROR';
  constructor(pluginId: string, dependencyId: string);
}
```

### Kernel Errors

#### `KernelError`

Base kernel error.

```typescript
class KernelError extends ZernError {
  readonly code: string = 'KERNEL_ERROR';
}
```

#### `KernelInitializationError`

Kernel initialization failed.

```typescript
class KernelInitializationError extends KernelError {
  readonly code = 'KERNEL_INITIALIZATION_ERROR';
  constructor(cause?: Error);
}
```

#### `CircularDependencyError`

Circular dependency detected.

```typescript
class CircularDependencyError extends KernelError {
  readonly code = 'CIRCULAR_DEPENDENCY_ERROR';
  constructor(cycle: readonly string[]);
}
```

### Version Errors

#### `VersionError`

Base version error.

```typescript
class VersionError extends ZernError {
  readonly code: string = 'VERSION_ERROR';
}
```

#### `VersionMismatchError`

Version mismatch error.

```typescript
class VersionMismatchError extends VersionError {
  readonly code = 'VERSION_MISMATCH_ERROR';
  constructor(pluginId: string, required: string, actual: string);
}
```

---

## ⏱️ Lifecycle Hooks

### `LifecycleHookContext`

Context provided to lifecycle hooks.

```typescript
interface LifecycleHookContext<TDeps = Record<string, unknown>> {
  readonly pluginName: string;
  readonly pluginId: PluginId;
  readonly kernel: KernelContext;
  readonly plugins: TDeps;
}
```

**Properties:**

- `pluginName` - The plugin's name
- `pluginId` - The plugin's unique ID
- `kernel` - Kernel context for accessing other plugins
- `plugins` - Type-safe dependencies with API and metadata access

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
