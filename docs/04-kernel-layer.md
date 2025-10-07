# Kernel Layer

> **Orchestration, initialization, and lifecycle management**

The Kernel Layer is responsible for orchestrating plugins, managing their lifecycle, and providing type-safe access to plugin APIs.

---

## 📦 Overview

**Location:** `src/kernel/`

**Key Components:**

- `KernelBuilder` - Fluent API for building kernels
- `PluginContainer` - Storage for plugin instances
- `LifecycleManager` - Initialization order and state management

---

## 🏗️ Building Kernels

### Basic Kernel

```typescript
import { createKernel } from '@zern/kernel';

const kernel = await createKernel().use(mathPlugin).use(calculatorPlugin).start();
```

### Kernel with Configuration

```typescript
const kernel = await createKernel()
  .use(mathPlugin)
  .use(calculatorPlugin)
  .config({
    autoGlobal: true,
    strictVersioning: true,
    logLevel: 'debug',
  })
  .start();
```

### Recommended Pattern: Export Kernel

```typescript
// main.ts
export const kernel = await createKernel().use(mathPlugin).use(calculatorPlugin).start();

// other-file.ts
import { kernel } from './main';

const math = kernel.get('math');
math.add(2, 3); // ✅ Full type safety!
```

---

## 🔧 Kernel Builder API

### `.use(plugin)` - Register Plugin

```typescript
interface KernelBuilder<U extends BuiltPlugin<string, unknown, unknown> = never> {
  use<P extends BuiltPlugin<string, unknown, unknown>>(plugin: P): KernelBuilder<U | P>;
}
```

**Example:**

```typescript
const kernel = await createKernel()
  .use(loggerPlugin) // Register first
  .use(mathPlugin) // Register second
  .use(calcPlugin) // Register third
  .start(); // Initialize all
```

**Key Points:**

- Registration order doesn't matter (dependency resolver handles it)
- Each `.use()` refines the kernel's type with the new plugin
- Plugins are not initialized until `.start()` is called

### `.config(config)` - Configure Kernel

```typescript
interface KernelBuilder<U> {
  config(config: Partial<KernelConfig>): KernelBuilder<U>;
}
```

**Configuration Options:**

| Option                  | Type                                     | Default  | Description                            |
| ----------------------- | ---------------------------------------- | -------- | -------------------------------------- |
| `autoGlobal`            | `boolean`                                | `true`   | Automatically register kernel globally |
| `strictVersioning`      | `boolean`                                | `true`   | Enforce strict version matching        |
| `circularDependencies`  | `boolean`                                | `false`  | Allow circular deps (not recommended)  |
| `initializationTimeout` | `number`                                 | `30000`  | Max initialization time in ms          |
| `extensionsEnabled`     | `boolean`                                | `true`   | Enable API extensions and proxies      |
| `logLevel`              | `'debug' \| 'info' \| 'warn' \| 'error'` | `'info'` | Logging verbosity                      |
| `errors`                | `ErrorConfig`                            | `{}`     | Error handling configuration           |

**Example:**

```typescript
const kernel = await createKernel()
  .use(mathPlugin)
  .config({
    autoGlobal: false, // Don't register globally
    logLevel: 'debug', // Verbose logging
    strictVersioning: false, // Allow looser version matching
    errors: {
      captureStackTrace: true,
      showSolutions: true,
    },
  })
  .start();
```

**Error Handling Configuration:**

See [Error Handling](./14-error-handling.md) for complete documentation on error configuration options.

### `.build()` - Build Without Starting

```typescript
interface KernelBuilder<U> {
  build(): BuiltKernel<PluginsMap<U>>;
}
```

**Example:**

```typescript
const builtKernel = createKernel().use(mathPlugin).build();

// Later...
const kernel = await builtKernel.init();
```

**Use Cases:**

- Defer initialization
- Test kernel building separately
- Custom initialization logic

### `.start()` - Build and Initialize

```typescript
interface KernelBuilder<U> {
  start(): Promise<Kernel<PluginsMap<U>>>;
}
```

**What happens:**

1. Validates all plugins are registered
2. Resolves dependencies
3. Calculates initialization order
4. Registers extensions and proxies
5. Initializes each plugin in order
6. Returns initialized kernel

**Example:**

```typescript
const kernel = await createKernel().use(loggerPlugin).use(mathPlugin).start(); // ← Async operation!

// Kernel is now ready
const math = kernel.get('math');
```

---

## 📦 Kernel Instance API

### `.get(name)` - Get Plugin API with $meta and $store

```typescript
interface Kernel<TPlugins> {
  get<TName extends keyof TPlugins>(name: TName): TPlugins[TName];
}
```

**Example:**

```typescript
const math = kernel.get('math'); // ✅ Type: MathAPI & { $meta, $store }
const calc = kernel.get('calculator'); // ✅ Type: CalculatorAPI & { $meta, $store }

// TypeScript error:
const unknown = kernel.get('unknown'); // ❌ Error: 'unknown' not in kernel
```

**Key Points:**

- Fully type-safe with complete autocomplete
- Returns initialized plugin API **plus** `$meta` and `$store`
- Throws `PluginNotFoundError` if plugin doesn't exist

**Accessing Plugin Metadata and Store:**

```typescript
const logger = kernel.get('logger');

// ✅ Use the API
logger.log('Hello World!');

// ✅ Access metadata
console.log(logger.$meta.name); // "logger"
console.log(logger.$meta.version); // "1.0.0"
console.log(logger.$meta.author); // Custom metadata

// ✅ Access and modify the store
console.log(logger.$store.count); // Access reactive state
logger.$store.count++; // Modify state

// ✅ Watch store changes
logger.$store.watch('count', change => {
  console.log(`Count changed: ${change.oldValue} → ${change.newValue}`);
});

// ✅ Use all Store methods
logger.$store.batch(() => {
  logger.$store.count++;
  logger.$store.errors++;
});

const doubled = logger.$store.computed(s => s.count * 2);
console.log(doubled.value);
```

**Complete Example:**

```typescript
// Define plugin with metadata and store
const mathPlugin = plugin('math', '1.0.0')
  .metadata({
    author: 'Zern Team',
    precision: 'high',
  })
  .store(() => ({
    operationCount: 0,
    lastResult: 0,
  }))
  .setup(({ store }) => ({
    add: (a: number, b: number) => {
      store.operationCount++;
      store.lastResult = a + b;
      return a + b;
    },
  }));

// Start kernel
const kernel = await createKernel().use(mathPlugin).start();

// Get plugin with full access
const math = kernel.get('math');

// Use API
const result = math.add(10, 5); // 15

// Access metadata (read-only)
console.log(math.$meta.name); // "math"
console.log(math.$meta.version); // "1.0.0"
console.log(math.$meta.author); // "Zern Team"
console.log(math.$meta.precision); // "high"

// Access store (reactive)
console.log(math.$store.operationCount); // 1
console.log(math.$store.lastResult); // 15

// Watch store changes
math.$store.watch('operationCount', change => {
  console.log(`Operations: ${change.newValue}`);
});

math.add(20, 30); // Triggers watcher
```

**What's included:**

| Property        | Type       | Description                                      |
| --------------- | ---------- | ------------------------------------------------ |
| **API methods** | `TApi`     | All plugin methods (add, multiply, etc.)         |
| **`$meta`**     | `Metadata` | Plugin metadata (name, version, custom metadata) |
| **`$store`**    | `Store<T>` | Complete reactive store with all Store methods   |

**Store Methods Available:**

When accessing `$store` from `kernel.get()`, you have the complete `Store` API:

- `watch(key, callback)` - Watch specific property changes
- `watchAll(callback)` - Watch all changes
- `watchBatch(callback)` - Watch batched changes
- `batch(fn)` - Batch multiple updates
- `transaction(fn)` - Atomic transactions with rollback
- `computed(selector)` - Create computed values
- `select(selector)` - Alias for computed
- `getHistory()` - Get change history (if enabled)
- `clearHistory()` - Clear history
- `getMetrics()` - Get performance metrics (if enabled)
- `clearWatchers()` - Remove all watchers

See [Store System](./13-store-system.md) for complete Store API documentation.

### `.shutdown()` - Graceful Shutdown

```typescript
interface Kernel<TPlugins> {
  shutdown(): Promise<void>;
}
```

**Example:**

```typescript
// Cleanup resources
await kernel.shutdown();

// After shutdown, kernel is no longer usable
```

**What happens:**

1. Plugins are shut down in reverse initialization order
2. Resources are cleaned up
3. State is reset

---

## 🗄️ Plugin Container

The **PluginContainer** stores plugin instances and manages their lifecycle.

### Interface

```typescript
interface PluginContainer {
  register<TName, TApi, TExt>(
    plugin: BuiltPlugin<TName, TApi, TExt>
  ): Result<void, PluginLoadError>;

  getInstance<TApi>(pluginName: string): Result<TApi, PluginNotFoundError>;

  setInstance<TApi>(pluginName: string, instance: TApi): Result<void, PluginNotFoundError>;

  hasInstance(pluginName: string): boolean;

  getRegistry(): PluginRegistry;
}
```

### Usage

The container is managed internally by the kernel, but can be accessed for advanced use cases:

```typescript
import { createPluginContainer } from '@zern/kernel';

const container = createPluginContainer();

// Register plugin
const result = container.register(mathPlugin);

// Check if plugin instance exists
if (container.hasInstance('math')) {
  const mathResult = container.getInstance('math');
  if (mathResult.success) {
    const math = mathResult.data;
  }
}
```

---

## 🔄 Lifecycle Manager

The **LifecycleManager** orchestrates plugin initialization and manages state transitions.

### Interface

```typescript
interface LifecycleManager {
  initialize(
    container: PluginContainer,
    extensions: ExtensionManager,
    config: KernelConfig
  ): Promise<Result<void, KernelInitializationError>>;

  shutdown(): Promise<void>;
}
```

### Initialization Process

```typescript
1. Get all registered plugins from registry
2. Register all extensions and proxies first
3. Resolve dependency order
4. For each plugin (in order):
   a. Change state to LOADING
   b. Resolve dependencies
   c. Execute setup function
   d. Apply extensions (add new methods)
   e. Apply proxies (intercept methods)
   f. Store final API instance
   g. Change state to LOADED
5. Return success or first error
```

### State Transitions

```
UNLOADED → LOADING → LOADED
             ↓
           ERROR
```

**State Management:**

```typescript
// During initialization
registry.setState(pluginId, PluginState.LOADING);

try {
  // Initialize plugin...
  registry.setState(pluginId, PluginState.LOADED);
} catch (error) {
  registry.setState(pluginId, PluginState.ERROR);
}
```

---

## 🔍 Initialization Deep Dive

### Step-by-Step Example

```typescript
// 1. Define plugins
const loggerPlugin = plugin('logger', '1.0.0').setup(() => ({
  log: (msg: string) => console.log(msg),
}));

const mathPlugin = plugin('math', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .setup(({ plugins }) => ({
    add: (a: number, b: number) => {
      plugins.logger.log(`Adding ${a} + ${b}`);
      return a + b;
    },
  }));

// 2. Start kernel
const kernel = await createKernel()
  .use(loggerPlugin) // Registered first
  .use(mathPlugin) // Registered second
  .start(); // Initialization begins
```

**What happens inside `.start()`:**

```typescript
// Step 1: Register plugins in container
container.register(loggerPlugin); // ✅
container.register(mathPlugin); // ✅

// Step 2: Validate dependencies
// mathPlugin depends on logger ^1.0.0
// logger version: 1.0.0 ✅ (satisfies ^1.0.0)

// Step 3: Calculate initialization order
// Result: [logger, math] (logger has no deps, must go first)

// Step 4: Initialize logger
registry.setState('logger', LOADING);
const loggerApi = loggerPlugin.setupFn({
  plugins: {},
  kernel: kernelContext,
});
container.setInstance('logger', loggerApi);
registry.setState('logger', LOADED);

// Step 5: Initialize math
registry.setState('math', LOADING);
const loggerInstance = container.getInstance('logger'); // Get dependency
const mathApi = mathPlugin.setupFn({
  plugins: { logger: loggerInstance },
  kernel: kernelContext,
});
container.setInstance('math', mathApi);
registry.setState('math', LOADED);

// Step 6: Return kernel
return new KernelImpl(/* ... */);
```

### Extension Application

When plugins have extensions:

```typescript
const advancedPlugin = plugin('advanced', '1.0.0')
  .extend(mathPlugin, () => ({
    multiply: (a: number, b: number) => a * b,
  }))
  .setup(() => ({}));

// During initialization:
// 1. Register extension BEFORE initializing math
extensions.registerExtension({
  targetPluginId: 'math',
  extensionFn: () => ({ multiply: ... }),
});

// 2. Initialize math normally
const mathApi = mathPlugin.setupFn(/* ... */);
// mathApi = { add: ... }

// 3. Apply extensions
const extendedApi = extensions.applyExtensions('math', mathApi);
// extendedApi = { add: ..., multiply: ... }

// 4. Store extended API
container.setInstance('math', extendedApi);
```

### Proxy Application

When plugins have proxies:

```typescript
const loggingPlugin = plugin('logging', '1.0.0')
  .proxy(mathPlugin, {
    include: ['add'],
    before: (ctx) => {
      console.log('Before add:', ctx.args);
    },
  })
  .setup(() => ({}));

// During initialization:
// 1. Register proxy BEFORE initializing math
extensions.registerProxy({
  targetPluginId: 'math',
  config: /* ... */,
});

// 2. Initialize math normally
const mathApi = mathPlugin.setupFn(/* ... */);

// 3. Apply proxies
const proxiedApi = extensions.applyExtensions('math', mathApi);
// proxiedApi.add is now proxied!

// 4. Store proxied API
container.setInstance('math', proxiedApi);
```

---

## ✅ Best Practices

### 1. Always Export the Kernel

✅ **Good:**

```typescript
// main.ts
export const kernel = await createKernel().use(mathPlugin).start();

// other-file.ts
import { kernel } from './main';
const math = kernel.get('math'); // ✅ Type-safe!
```

❌ **Bad:**

```typescript
// main.ts
const kernel = await createKernel().use(mathPlugin).start();
// Not exported!

// other-file.ts
// Can't access kernel 😢
```

### 2. Handle Initialization Errors

✅ **Good:**

```typescript
try {
  const kernel = await createKernel().use(mathPlugin).start();
} catch (error) {
  if (error instanceof KernelInitializationError) {
    console.error('Kernel failed:', error.cause);
  }
  throw error;
}
```

❌ **Bad:**

```typescript
const kernel = await createKernel().use(mathPlugin).start(); // Might throw, but not handled
```

### 3. Shutdown Gracefully

✅ **Good:**

```typescript
// Cleanup on application exit
process.on('SIGINT', async () => {
  await kernel.shutdown();
  process.exit(0);
});
```

❌ **Bad:**

```typescript
// Just exit without cleanup
process.on('SIGINT', () => {
  process.exit(0); // Resources not cleaned up!
});
```

### 4. Use Type-Safe Configuration

✅ **Good:**

```typescript
const config: Partial<KernelConfig> = {
  logLevel: 'debug',
  strictVersioning: true,
};

const kernel = await createKernel().use(mathPlugin).config(config).start();
```

❌ **Bad:**

```typescript
const kernel = await createKernel()
  .use(mathPlugin)
  .config({
    logLevel: 'verbose', // ❌ Not a valid level
    unknownOption: true, // ❌ Not a valid option
  } as any)
  .start();
```

---

## 🔍 Deep Dive: Type Inference

### Kernel Type Evolution

```typescript
// Step 1: Empty kernel
const k1 = createKernel();
// Type: KernelBuilder<never>

// Step 2: Add math plugin
const k2 = k1.use(mathPlugin);
// Type: KernelBuilder<MathPlugin>

// Step 3: Add calculator plugin
const k3 = k2.use(calculatorPlugin);
// Type: KernelBuilder<MathPlugin | CalculatorPlugin>

// Step 4: Start kernel
const kernel = await k3.start();
// Type: Kernel<{ math: MathAPI, calculator: CalculatorAPI }>

// Step 5: Get plugin
const math = kernel.get('math');
// Type: MathAPI
```

### Union to Intersection Magic

```typescript
// Internal type transformation:
type Plugins = MathPlugin | CalculatorPlugin;

// PluginsMap converts union to object:
type PluginsMap<Plugins> = {
  [K in PluginNameOf<Plugins>]: ApiForName<Plugins, K>;
};

// Result:
type FinalMap = {
  math: MathAPI;
  calculator: CalculatorAPI;
};
```

---

## 📚 Next Steps

Now that you understand the Kernel Layer, proceed to:

**[Extension System →](./05-extension-system.md)**  
Learn how to extend plugin APIs for advanced functionality.

---

[← Back to Index](./README.md) | [Next: Extension System →](./05-extension-system.md)
