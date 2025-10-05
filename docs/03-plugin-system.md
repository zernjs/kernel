# Plugin System

> **Creating, building, and managing plugins**

The Plugin System is the heart of Zern Kernel. It provides a fluent API for defining plugins with dependencies, extensions, proxies, and shared state.

---

## 📦 Overview

**Location:** `src/plugin/`

**Key Components:**

- `PluginBuilder` - Fluent API for building plugins
- `PluginRegistry` - Storage and metadata management
- `DependencyResolver` - Topological sorting and validation

---

## 🏗️ Building Plugins

### Basic Plugin

```typescript
import { plugin } from '@zern/kernel';

const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
}));
```

**Components:**

- `'math'` - Plugin name (must be unique)
- `'1.0.0'` - Semantic version
- `.setup(() => ({ ... }))` - API factory function

### Plugin with Dependencies

```typescript
const calculatorPlugin = plugin('calculator', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .setup(({ plugins }) => {
    const math = plugins.math; // ✅ Type-safe!

    return {
      square: (x: number) => math.multiply(x, x),
      cube: (x: number) => math.multiply(x, math.multiply(x, x)),
    };
  });
```

**Key Points:**

- Dependencies are specified with `.depends()`
- Version ranges follow semver (`^1.0.0`, `~2.1.0`, `*`)
- Dependencies are injected into `setup` context

---

## 🔧 Plugin Builder API

### `.setup(fn)` - Define Plugin API

```typescript
interface PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
  setup<TNewApi>(
    fn: (ctx: PluginSetupContext<TDeps, TStore>) => TNewApi
  ): BuiltPlugin<TName, TNewApi, TExtMap, TMetadata, TStore>;
}
```

**Setup Context:**

```typescript
interface PluginSetupContext<TDeps, TStore> {
  readonly plugins: TDeps; // Injected dependencies
  readonly kernel: KernelContext; // Kernel access
  readonly store: TStore; // store access
}
```

**Example:**

```typescript
plugin('logger', '1.0.0').setup(({ kernel }) => {
  console.log(`Initializing in kernel: ${kernel.id}`);

  return {
    log: (msg: string) => console.log(msg),
    error: (msg: string) => console.error(msg),
  };
});
```

### `.depends(plugin, version)` - Add Dependency

```typescript
interface PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
  depends<TDepName extends string, TDepApi, TDepExtMap, TDepMetadata, TDepStore>(
    plugin: BuiltPlugin<TDepName, TDepApi, TDepExtMap, TDepMetadata, TDepStore>,
    versionRange?: string
  ): PluginBuilder<
    TName,
    TApi,
    TDeps & Record<TDepName, TDepApi & { __meta__?: TDepMetadata }>,
    TExtMap,
    TMetadata,
    TStore
  >;
}
```

**Version Ranges:**

- `^1.0.0` - Compatible with version 1.x.x (default)
- `~1.2.0` - Compatible with version 1.2.x
- `*` - Any version
- `1.0.0` - Exact version

**Example:**

```typescript
plugin('advanced', '1.0.0')
  .depends(mathPlugin, '^1.0.0') // Major version 1
  .depends(loggerPlugin, '~2.1.0') // Minor version 2.1
  .depends(utilsPlugin, '*') // Any version
  .setup(({ plugins }) => {
    // plugins.math - MathAPI
    // plugins.logger - LoggerAPI
    // plugins.utils - UtilsAPI
    return {
      /* API */
    };
  });
```

### `.store(factory)` - Shared Plugin State

```typescript
interface PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
  store<TNewStore>(
    factory: () => TNewStore
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TNewStore>;
}
```

The `.store()` method creates a **shared, mutable state** that is accessible across:

- All lifecycle hooks (`onInit`, `onReady`, `onShutdown`, `onError`)
- The `setup` function
- All proxy interceptors (`before`, `after`, `around`, `onError`)

**Key Benefits:**

- ✅ **Type-safe** - Automatic type inference, no generics needed
- ✅ **Persistent** - State survives across all plugin lifecycle stages
- ✅ **Mutable** - Can be modified in any hook or interceptor
- ✅ **Scoped** - Each plugin has its own isolated store

**Example:**

```typescript
const databasePlugin = plugin('database', '1.0.0')
  // Define store with automatic type inference
  .store(() => ({
    connection: null as DatabaseConnection | null,
    queryCount: 0,
    errors: [] as Error[],
  }))
  // Access store in onInit (before setup)
  .onInit(async ({ store }) => {
    store.connection = await createConnection();
  })
  // Access store in proxy interceptors
  .proxy({
    include: ['query'],
    before: ctx => {
      ctx.store.queryCount++; // ✅ Type-safe access
    },
    onError: (error, ctx) => {
      ctx.store.errors.push(error); // ✅ Track errors
    },
  })
  // Access store in setup
  .setup(({ store }) => ({
    query: async (sql: string) => {
      if (!store.connection) {
        throw new Error('Not connected');
      }
      return await store.connection.execute(sql);
    },
    getStats: () => ({
      queries: store.queryCount,
      errors: store.errors.length,
    }),
  }))
  // Access store + API in onReady
  .onReady(({ store, api }) => {
    console.log(`Database ready. Queries: ${store.queryCount}`);
    console.log('Stats:', api.getStats()); // ✅ API is available
  })
  // Access store + API in onShutdown
  .onShutdown(async ({ store, api }) => {
    console.log('Final stats:', api.getStats());
    await store.connection?.close();
  });
```

**Important Notes:**

- The factory function is called once during plugin build
- Store is initialized before `onInit` hook
- Store is mutable - changes persist across all hooks and interceptors
- Each plugin instance has its own isolated store
- For type safety, define the store type inline in the factory return

**Reactive Features:**

Stores are **automatically reactive** with powerful features like:

- ✅ `watch()` - Monitor specific property changes
- ✅ `watchAll()` - Monitor all changes
- ✅ `batch()` - Group multiple changes
- ✅ `transaction()` - Atomic updates with rollback
- ✅ `computed()` - Memoized derived values

> 📚 **For complete documentation on reactive stores**, see [Store System](./13-store-system.md)

### `.extend(target, fn)` - Extend Another Plugin

```typescript
interface PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
  extend<
    TTargetName extends string,
    TTargetApi,
    TTargetExtMap,
    TTargetMetadata,
    TTargetStore,
    TExt extends object,
  >(
    target: BuiltPlugin<TTargetName, TTargetApi, TTargetExtMap, TTargetMetadata, TTargetStore>,
    fn: (api: TTargetApi) => TExt
  ): PluginBuilder<TName, TApi, TDeps, TExtMap & Record<TTargetName, TExt>, TMetadata, TStore>;
}
```

**Example:**

```typescript
const advancedMathPlugin = plugin('advanced-math', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .extend(mathPlugin, mathApi => ({
    // Add new methods to math plugin
    power: (base: number, exp: number) => Math.pow(base, exp),
    sqrt: (x: number) => Math.sqrt(x),
  }))
  .setup(() => ({
    // Advanced math's own API
    factorial: (n: number) => (n <= 1 ? 1 : n * factorial(n - 1)),
  }));

// After kernel initialization:
const math = kernel.get('math');
math.power(2, 3); // ✅ Extended method available!
math.sqrt(16); // ✅ Extended method available!
```

### `.proxy()` - Intercept Methods

The `.proxy()` method allows intercepting and modifying plugin method behavior. Supports **4 modes**:

1. **Self-proxy** - `.proxy({ ... })` - Proxy own methods
2. **Single plugin proxy** - `.proxy(plugin, { ... })` - Proxy specific plugin (requires `.depends()`)
3. **Dependencies proxy** - `.proxy('*', { ... })` - Proxy all dependencies
4. **Global proxy** - `.proxy('**', { ... })` - Proxy all plugins in kernel

**Example (Single Plugin Proxy):**

```typescript
const loggingPlugin = plugin('logging', '1.0.0')
  .depends(mathPlugin, '^1.0.0') // ✅ Required!
  .proxy(mathPlugin, {
    methods: 'add', // Intercept only 'add' method
    before: ctx => {
      console.log(`Calling ${ctx.method} with args:`, ctx.args);
    },
    after: (result, ctx) => {
      console.log(`${ctx.method} returned:`, result);
      return result;
    },
  })
  .setup(() => ({}));

// When math.add() is called, the proxies execute:
const result = math.add(2, 3);
// Console: "Calling add with args: [2, 3]"
// Console: "add returned: 5"
```

**Example (Global Proxy):**

```typescript
const monitorPlugin = plugin('monitor', '1.0.0')
  .proxy('**', {
    // ✅ Proxies ALL plugins in kernel
    before: ctx => {
      console.log(`[MONITOR] ${ctx.plugin}.${ctx.method}() called`);
    },
  })
  .setup(() => ({}));
```

For complete documentation, see [Proxy System](./12-proxy-system.md).

### `.metadata(data)` - Attach Custom Metadata

Add custom metadata to your plugin that can be accessed in lifecycle hooks and dependency contexts.

```typescript
interface PluginBuilder<TName, TApi, TDeps, TExtMap, TMetadata, TStore> {
  metadata<TNewMetadata extends Record<string, unknown>>(
    metadata: TNewMetadata
  ): PluginBuilder<TName, TApi, TDeps, TExtMap, TNewMetadata, TStore>;
}
```

**Example:**

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .metadata({
    author: 'Zern Team',
    category: 'data',
    connectionString: 'postgresql://localhost:5432/mydb',
    maxConnections: 10,
  })
  .setup(() => ({
    query: async (sql: string) => {
      /* implementation */
    },
    connect: async () => {
      /* implementation */
    },
  }));
```

**Accessing Metadata in Lifecycle Hooks:**

Metadata is accessible via the `$meta` property on dependencies within lifecycle hooks:

```typescript
const analyticsPlugin = plugin('analytics', '1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .onInit(({ plugins }) => {
    // ✅ Access plugin API
    plugins.database.connect();

    // ✅ Access metadata with full type safety
    console.log(plugins.database.$meta.author); // "Zern Team"
    console.log(plugins.database.$meta.connectionString); // "postgresql://..."
    console.log(plugins.database.$meta.name); // "database"
    console.log(plugins.database.$meta.version); // Version object
    console.log(plugins.database.$meta.id); // PluginId
  })
  .setup(() => ({
    /* API */
  }));
```

**Standard Metadata Properties:**

Every plugin automatically includes:

- `name` - Plugin name (string)
- `version` - Plugin version (Version object)
- `id` - Plugin ID (PluginId)
- Plus all custom metadata defined via `.metadata()`

---

## 📋 Plugin Registry

The **PluginRegistry** manages plugin storage and metadata.

### Interface

```typescript
interface PluginRegistry {
  register<TName extends string, TApi, TExt, TMetadata, TStore>(
    plugin: BuiltPlugin<TName, TApi, TExt, TMetadata, TStore>
  ): Result<void, PluginLoadError>;

  get<TApi>(
    pluginId: PluginId
  ): Result<BuiltPlugin<string, TApi, unknown, unknown, unknown>, PluginNotFoundError>;

  getMetadata(pluginId: PluginId): Result<PluginMetadata, PluginNotFoundError>;

  setState(pluginId: PluginId, state: PluginState): Result<void, PluginNotFoundError>;

  getAll(): readonly PluginMetadata[];

  clear(): void;
}
```

### Usage

```typescript
import { createPluginRegistry } from '@zern/kernel';

const registry = createPluginRegistry();

// Register plugin
const result = registry.register(mathPlugin);
if (!result.success) {
  console.error(result.error);
}

// Get plugin
const pluginResult = registry.get(createPluginId('math'));
if (pluginResult.success) {
  const plugin = pluginResult.data;
}

// Get metadata
const metaResult = registry.getMetadata(createPluginId('math'));
if (metaResult.success) {
  console.log(metaResult.data.state); // UNLOADED, LOADING, LOADED, ERROR
}

// Get all plugins
const allPlugins = registry.getAll();
```

---

## 🔄 Dependency Resolution

The **DependencyResolver** calculates plugin initialization order using topological sort.

### Algorithm

```typescript
1. Validate all dependencies exist
2. Check version compatibility
3. Detect circular dependencies (DFS)
4. Calculate initialization order (Kahn's algorithm)
```

### Interface

```typescript
interface DependencyResolver {
  resolve(
    plugins: readonly PluginMetadata[]
  ): Result<readonly PluginId[], CircularDependencyError | PluginDependencyError>;
}
```

### Usage

```typescript
import { createDependencyResolver } from '@zern/kernel';

const resolver = createDependencyResolver();
const plugins = registry.getAll();

const orderResult = resolver.resolve(plugins);
if (orderResult.success) {
  const order = orderResult.data; // [logger, math, calculator]
  // Initialize in this order
} else {
  // Handle circular dependency or missing dependency
  console.error(orderResult.error);
}
```

### Validation

**Missing Dependency:**

```typescript
const calculator = plugin('calculator', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .setup(() => ({}));

// If mathPlugin is not registered:
const result = resolver.resolve([calculator]);
// Result: failure(PluginDependencyError)
```

**Version Mismatch:**

```typescript
const math = plugin('math', '2.0.0').setup(() => ({}));
const calc = plugin('calc', '1.0.0')
  .depends(math, '^1.0.0') // Requires major version 1
  .setup(() => ({}));

const result = resolver.resolve([math, calc]);
// Result: failure(PluginDependencyError)
```

**Circular Dependency:**

```typescript
const pluginA = plugin('a', '1.0.0')
  .depends(pluginB, '*')
  .setup(() => ({}));

const pluginB = plugin('b', '1.0.0')
  .depends(pluginA, '*')
  .setup(() => ({}));

const result = resolver.resolve([pluginA, pluginB]);
// Result: failure(CircularDependencyError)
```

---

## ✅ Best Practices

### 1. Use Semantic Versioning

✅ **Good:**

```typescript
plugin('math', '1.0.0'); // Major.Minor.Patch
plugin('math', '1.2.3'); // With all parts
plugin('math', '2.0.0'); // Major version bump for breaking changes
```

❌ **Bad:**

```typescript
plugin('math', '1'); // Missing parts
plugin('math', 'latest'); // Not semantic
```

### 2. Declare All Dependencies

✅ **Good:**

```typescript
plugin('calculator', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .depends(loggerPlugin, '*')
  .setup(({ plugins }) => {
    const math = plugins.math; // ✅ Available
    return {
      /* API */
    };
  });
```

❌ **Bad:**

```typescript
plugin('calculator', '1.0.0').setup(({ kernel }) => {
  // Assuming math is available without declaring dependency
  const math = kernel.get('math'); // ⚠️ Might not be initialized!
  return {
    /* API */
  };
});
```

### 3. Use Version Ranges Wisely

✅ **Good:**

```typescript
.depends(mathPlugin, '^1.0.0')  // Allow patch & minor updates
.depends(corePlugin, '~2.1.0')  // Allow only patch updates
.depends(utilsPlugin, '*')      // Any version (for utilities)
```

❌ **Bad:**

```typescript
.depends(mathPlugin, '*')       // Too permissive (might break)
.depends(corePlugin, '1.0.0')   // Too restrictive (no updates)
```

### 4. Keep Setup Functions Pure

✅ **Good:**

```typescript
.setup(({ plugins }) => {
  // Pure function: only creates API
  return {
    add: (a, b) => a + b,
  };
});
```

❌ **Bad:**

```typescript
.setup(({ plugins }) => {
  // Side effects during setup!
  window.myGlobal = 'something';
  startBackgroundTask();

  return { /* API */ };
});
```

### 5. Type Your APIs

✅ **Good:**

```typescript
interface MathAPI {
  add: (a: number, b: number) => number;
  subtract: (a: number, b: number) => number;
}

plugin('math', '1.0.0').setup(
  (): MathAPI => ({
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
  })
);
```

❌ **Bad:**

```typescript
plugin('math', '1.0.0').setup(() => ({
  add: (a: any, b: any) => a + b, // any types!
  subtract: (a: any, b: any) => a - b,
}));
```

---

## 🔍 Deep Dive: Type Inference

### Dependency Type Inference

```typescript
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
}));

const calcPlugin = plugin('calc', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .setup(({ plugins }) => {
    // TypeScript knows plugins.math exists!
    type MathAPI = typeof plugins.math;
    // MathAPI = { add: (a: number, b: number) => number }

    return {
      /* API */
    };
  });
```

### Extension Type Merging

```typescript
const advancedPlugin = plugin('advanced', '1.0.0')
  .extend(mathPlugin, () => ({
    multiply: (a: number, b: number) => a * b,
  }))
  .setup(() => ({}));

// After kernel init:
const math = kernel.get('math');
// Type: { add: ..., multiply: ... }
```

---

## 📚 Next Steps

Now that you understand the Plugin System, proceed to:

**[Kernel Layer →](./04-kernel-layer.md)**  
Learn how the kernel orchestrates plugin initialization and lifecycle.

---

[← Back to Index](./README.md) | [Next: Kernel Layer →](./04-kernel-layer.md)
