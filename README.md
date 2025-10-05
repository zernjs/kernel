<div align="center">

# 🔥 Zern Kernel

### Strongly-Typed Plugin Kernel

> **Ultra-lightweight plugin orchestration with exceptional developer experience**

</div>

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/) [![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT) [![Coverage](https://img.shields.io/endpoint?style=flat-square&url=https%3A%2F%2Fraw.githubusercontent.com%2Fzernjs%2Fzern-kernel%2Fmain%2Fcoverage%2Fcoverage-endpoint.json)](./coverage/coverage-summary.json)

</div>

<div align="center">

[![CI](https://github.com/zernjs/zern-kernel/actions/workflows/ci.yml/badge.svg?style=flat-square)](https://github.com/zernjs/zern-kernel/actions/workflows/ci.yml) [![CodeQL](https://github.com/zernjs/zern-kernel/actions/workflows/codeql.yml/badge.svg?style=flat-square)](https://github.com/zernjs/zern-kernel/actions/workflows/codeql.yml) [![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/zernjs/zern-kernel?label=OpenSSF%20Scorecard&style=flat-square)](https://securityscorecards.dev/viewer/?uri=github.com/zernjs/zern-kernel)

</div>

<div align="center">

[**Features**](#-features) • [**Quick Start**](#-quick-start) • [**Documentation**](./docs/README.md) • [**Examples**](#-examples) • [**API Reference**](./docs/09-api-reference.md)

</div>

---

## 🌟 Overview

**Zern Kernel** is a next-generation plugin system designed for **exceptional developer experience**. It provides a minimal, type-safe core that enables plugins to work naturally like independent libraries, with automatic dependency resolution, transparent API augmentation, and powerful method interception.

### Why Zern Kernel?

- 🎯 **Natural API Design** - Plugins feel like native libraries, not framework components
- 🔒 **Complete Type Safety** - Full TypeScript support with autocomplete everywhere
- 🚀 **Zero Boilerplate** - Fluent API eliminates ceremonial code
- 🔄 **Intelligent Resolution** - Automatic dependency ordering with version validation
- ⚡ **Runtime Flexibility** - Extend, intercept, and modify plugin behavior dynamically

---

## ✨ Features

### Core Capabilities

| Feature                           | Description                                                               |
| --------------------------------- | ------------------------------------------------------------------------- |
| 🪶 **Minimal Core**               | Only essential functionality - register, initialize, shutdown             |
| 🔄 **Fluent API**                 | Clean, chainable interface for plugin and kernel configuration            |
| 🤖 **Auto Dependency Resolution** | Topological sorting with intelligent cycle detection                      |
| 🔧 **API Extensions**             | Plugins can seamlessly extend other plugins' APIs                         |
| 🎭 **Method Proxying**            | Intercept and modify behavior with before/after/around hooks              |
| ⏱️ **Lifecycle Hooks**            | `onInit`, `onReady`, `onShutdown`, `onError` for resource management      |
| 🗄️ **Reactive Store**             | Automatic reactive state with watchers, computed values, and transactions |
| 🏷️ **Custom Metadata**            | Attach and access metadata with full type safety via `$meta`              |
| 📦 **Direct Exports**             | Import plugin methods directly like a normal library                      |
| 🛡️ **Result Pattern**             | Functional error handling without exceptions                              |
| 🔍 **Version Control**            | Semantic versioning with flexible constraint matching                     |

### Advanced Features

- ✅ **4 Proxy Modes**: Self-proxy, single plugin, dependencies, and global
- ✅ **Kernel-Level Proxies**: Application-level interception via `createKernel().proxy()`
- ✅ **Type-Safe Context**: Plugin dependencies and metadata are fully typed
- ✅ **Priority-Based Execution**: Control proxy execution order with priorities
- ✅ **Conditional Proxies**: Apply interceptors based on runtime conditions
- ✅ **Method Selectors**: Fine-grained control with include/exclude patterns

---

## 🚀 Quick Start

### Installation

```bash
npm install @zern/kernel
```

### Basic Example

```typescript
import { createKernel, plugin } from '@zern/kernel';

// 1️⃣ Create a database plugin
const databasePlugin = plugin('database', '1.0.0')
  .metadata({
    author: 'Zern Team',
    category: 'data',
  })
  .setup(() => ({
    async connect(url: string) {
      console.log(`Connected to: ${url}`);
      return { connected: true };
    },
    users: {
      async create(userData: { name: string; email: string }) {
        const id = Math.random().toString(36).slice(2);
        console.log(`User created: ${id}`);
        return { id, ...userData };
      },
    },
  }));

// 2️⃣ Create auth plugin with dependency
const authPlugin = plugin('auth', '1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .onInit(({ plugins }) => {
    console.log('Auth initializing...');
    console.log('Database author:', plugins.database.$meta.author);
  })
  .setup(({ plugins }) => ({
    async validateToken(token: string) {
      console.log(`Validating token: ${token}`);
      return token === 'valid-token';
    },
  }));

// 3️⃣ Initialize kernel and use plugins
const kernel = await createKernel().use(databasePlugin).use(authPlugin).start();

// ✅ Type-safe plugin access
const db = kernel.get('database');
await db.connect('postgresql://localhost:5432/mydb');

const user = await db.users.create({
  name: 'John Doe',
  email: 'john@example.com',
});

const auth = kernel.get('auth');
const isValid = await auth.validateToken('valid-token');

// Cleanup
await kernel.shutdown();
```

---

## 🔧 Core Concepts

### 1. Plugin Creation

```typescript
const mathPlugin = plugin('math', '1.0.0')
  .metadata({ author: 'Zern Team' })
  .setup(() => ({
    add: (a: number, b: number) => a + b,
    multiply: (a: number, b: number) => a * b,
  }));
```

### 2. Dependencies

```typescript
const calculatorPlugin = plugin('calculator', '1.0.0')
  .depends(mathPlugin, '^1.0.0') // Semantic versioning
  .setup(({ plugins }) => ({
    calculate: (expr: string) => {
      // Access math plugin with full type safety
      return plugins.math.add(1, 2);
    },
  }));
```

### 3. Reactive Store

Create **automatically reactive** type-safe state accessible across all plugin stages:

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .store(() => ({
    connection: null as Connection | null,
    queryCount: 0,
    startTime: Date.now(),
  }))
  .onInit(async ({ store }) => {
    // Initialize connection in store
    store.connection = await createConnection();

    // 🔥 Watch for changes automatically
    store.watch('queryCount', change => {
      console.log(`Queries: ${change.oldValue} → ${change.newValue}`);
    });
  })
  .proxy({
    include: ['*'],
    before: ctx => {
      // Track queries in store (triggers watchers automatically)
      ctx.store.queryCount++;
    },
  })
  .setup(({ store }) => ({
    query: async (sql: string) => {
      // Access store in methods
      if (!store.connection) throw new Error('Not connected');
      return await store.connection.execute(sql);
    },
    getStats: () => ({
      queries: store.queryCount,
      uptime: Date.now() - store.startTime,
    }),
  }))
  .onReady(({ store, api }) => {
    // Access both store and api in hooks
    console.log(`Database ready. Stats:`, api.getStats());
  });
```

**Reactive Features:**

- ✅ **Automatic reactivity** - No manual setup required
- ✅ **Watch changes** - `watch()`, `watchAll()`, `watchBatch()`
- ✅ **Computed values** - Memoized derived state with `computed()`
- ✅ **Batch updates** - Group changes with `batch()`
- ✅ **Transactions** - Atomic updates with automatic rollback
- ✅ **Performance** - ~10x faster with optimized cloning and indexed watchers
- ✅ **Type inference** - No generics needed, full autocomplete
- ✅ **Isolated** - Each plugin has its own store

> 📚 See [Store System](./docs/13-store-system.md) for complete documentation

### 4. API Extensions

Extend another plugin's API transparently:

```typescript
const advancedMathPlugin = plugin('advancedMath', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .extend(mathPlugin, api => ({
    // Add new methods to math plugin
    power: (base: number, exp: number) => Math.pow(base, exp),
    sqrt: (x: number) => Math.sqrt(x),
  }))
  .setup(() => ({}));

// After kernel initialization:
const math = kernel.get('math');
math.power(2, 3); // ✅ Extended method available!
math.sqrt(16); // ✅ All extensions are merged
```

### 5. Method Proxying

Intercept and modify plugin behavior:

```typescript
const loggingPlugin = plugin('logging', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .proxy(mathPlugin, {
    include: ['add'], // Intercept specific method
    before: ctx => {
      console.log(`[LOG] Calling ${ctx.method} with:`, ctx.args);
    },
    after: (result, ctx) => {
      console.log(`[LOG] ${ctx.method} returned:`, result);
      return result;
    },
  })
  .setup(() => ({}));
```

**Proxy Modes:**

```typescript
// 1. Self-proxy: Intercept own methods
.proxy({ include: ['add'], before: ctx => console.log('self') })

// 2. Single plugin proxy: Intercept specific plugin
.depends(mathPlugin, '^1.0.0')
.proxy(mathPlugin, { before: ctx => console.log('single') })

// 3. Dependencies proxy: Intercept all dependencies
.proxy('*', { before: ctx => console.log('all deps') })

// 4. Global proxy: Intercept ALL plugins
.proxy('**', { before: ctx => console.log('global') })
```

### 6. Kernel-Level Proxies

Apply proxies at the application level:

```typescript
const kernel = await createKernel()
  .use(mathPlugin)
  .use(apiPlugin)
  // Global logging for all plugins
  .proxy('**', {
    priority: 80,
    before: ctx => {
      console.log(`[LOG] ${ctx.plugin}.${ctx.method}() called`);
    },
  })
  // Specific auth for API plugin
  .proxy(apiPlugin, {
    priority: 100,
    include: ['create*', 'update*', 'delete*'],
    before: ctx => checkPermissions(ctx.method),
  })
  .start();
```

### 7. Lifecycle Hooks

Manage plugin initialization, readiness, and cleanup:

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .metadata({ connectionString: 'postgresql://localhost:5432/db' })
  .onInit(({ plugins }) => {
    console.log('Initializing database...');
  })
  .onReady(({ plugins }) => {
    console.log('Database ready!');
  })
  .onShutdown(({ plugins }) => {
    console.log('Closing connections...');
  })
  .onError(({ error, plugins }) => {
    console.error('Database error:', error);
  })
  .setup(() => ({
    query: async (sql: string) => {
      /* ... */
    },
  }));
```

### 8. Direct Method Exports

Use plugins like normal libraries:

```typescript
// In your plugin file:
export const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
}));

// Export direct methods
export const { add, multiply } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  multiply: (a: number, b: number): number => 0,
});

// Usage in other files:
import { add, multiply } from './math-plugin';
console.log(add(2, 3)); // ✅ Full type safety!
console.log(multiply(4, 5)); // ✅ Autocomplete works!
```

---

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

| Document                                                        | Description                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| [**Architecture Overview**](./docs/01-architecture-overview.md) | System design and layer architecture                            |
| [**Getting Started**](./docs/02-getting-started.md)             | Installation and first steps                                    |
| [**Plugin System**](./docs/03-plugin-system.md)                 | Creating and managing plugins                                   |
| [**Kernel Layer**](./docs/04-kernel-layer.md)                   | Kernel initialization and lifecycle                             |
| [**Extension System**](./docs/05-extension-system.md)           | Extending plugin APIs                                           |
| [**Direct Exports**](./docs/06-direct-exports.md)               | Library-like method exports                                     |
| [**Lifecycle Hooks**](./docs/07-lifecycle-hooks.md)             | Plugin lifecycle management                                     |
| [**Metadata System**](./docs/08-metadata-system.md)             | Custom metadata with type safety                                |
| [**API Reference**](./docs/09-api-reference.md)                 | Complete API documentation                                      |
| [**Best Practices**](./docs/10-best-practices.md)               | Patterns and guidelines                                         |
| [**Proxy System**](./docs/12-proxy-system.md)                   | Method interception and proxying                                |
| [**Store System**](./docs/13-store-system.md)                   | Reactive state with watchers, computed values, and transactions |

---

## 💡 Examples

Explore complete examples in the [`examples/`](./examples/) directory:

- [**Basic Usage**](./examples/basic-usage.ts) - Plugin creation, dependencies, and kernel initialization
- [**Direct Usage**](./examples/direct-usage.ts) - Direct method exports and library-like usage
- [**Store Demo**](./examples/store-demo.ts) - Comprehensive reactive store features (watch, computed, batch, transaction)
- [**Store Example**](./examples/store-example.ts) - Store usage with lifecycle hooks and plugin integration
- [**Store Benchmark**](./examples/store-benchmark.ts) - Performance benchmarks (~10x faster with optimizations)
- [**Proxy Demo**](./examples/proxy-demo.ts) - Method interception with multiple proxies
- [**Proxy Complete Demo**](./examples/proxy-complete-demo.ts) - All 4 proxy modes in action
- [**Kernel Proxy Demo**](./examples/kernel-proxy-demo.ts) - Kernel-level proxy examples
- [**Simple Plugin**](./examples/simple-plugin/) - Minimalist plugin boilerplate
- [**Math Plugin**](./examples/math-plugin/) - Opinionated, scalable plugin architecture

---

## 🎯 Use Cases

### Cross-Cutting Concerns

```typescript
// Global logging
const loggingPlugin = plugin('logging', '1.0.0')
  .proxy('**', {
    before: ctx => console.log(`[LOG] ${ctx.plugin}.${ctx.method}()`),
  })
  .setup(() => ({}));

// Performance monitoring (using plugin store)
const timingPlugin = plugin('timing', '1.0.0')
  .store(() => new Map<string, number>()) // Map to store start times by method
  .proxy('**', {
    before: ctx => {
      const key = `${ctx.plugin}.${ctx.method}`;
      ctx.store.set(key, Date.now());
    },
    after: (result, ctx) => {
      const key = `${ctx.plugin}.${ctx.method}`;
      const startTime = ctx.store.get(key);
      if (startTime) {
        console.log(`⏱️ ${key} took ${Date.now() - startTime}ms`);
        ctx.store.delete(key);
      }
      return result;
    },
  })
  .setup(() => ({}));
```

### Authentication & Authorization

```typescript
const authPlugin = plugin('auth', '1.0.0')
  .depends(apiPlugin, '^1.0.0')
  .proxy(apiPlugin, {
    include: ['create*', 'update*', 'delete*'],
    priority: 100, // Execute first
    before: ctx => {
      if (!isAuthenticated()) {
        ctx.skip();
        throw new Error('Unauthorized');
      }
    },
  })
  .setup(() => ({
    /* ... */
  }));
```

### Caching

```typescript
const cachePlugin = plugin('cache', '1.0.0')
  .depends(apiPlugin, '^1.0.0')
  .proxy(apiPlugin, {
    include: ['get*', 'find*'],
    priority: 90,
    around: async (ctx, next) => {
      const key = `${ctx.method}:${JSON.stringify(ctx.args)}`;
      const cached = cache.get(key);
      if (cached) return cached;

      const result = await next();
      cache.set(key, result);
      return result;
    },
  })
  .setup(() => ({}));
```

---

## 🔍 Advanced Configuration

### Kernel Configuration

```typescript
const kernel = await createKernel()
  .use(myPlugin)
  .withConfig({
    autoGlobal: true, // Auto-register as global kernel
    strictVersioning: true, // Enforce strict version matching
    circularDependencies: false, // Disallow circular dependencies
    initializationTimeout: 30000, // Timeout in milliseconds
    extensionsEnabled: true, // Enable plugin extensions
    logLevel: 'info', // Log level: debug | info | warn | error
  })
  .start();
```

### Version Constraints

```typescript
const authPlugin = plugin('auth', '1.0.0')
  .depends(databasePlugin, '^1.0.0') // Compatible with 1.x.x
  .depends(cachePlugin, '>=2.0.0') // Requires 2.0.0 or higher
  .depends(utilsPlugin, '~1.2.3') // Compatible with 1.2.x
  .setup(({ plugins }) => ({
    /* ... */
  }));
```

---

## 🛠️ API Quick Reference

### Creating Plugins

```typescript
plugin(name: string, version: string)
  .metadata(data: Record<string, unknown>)
  .store(factory: () => state)                 // Reactive store (watch, computed, batch, transaction)
  .depends(plugin: BuiltPlugin, versionRange?: string)
  .extend(target: BuiltPlugin, fn: (api) => extensions)
  .proxy(config: ProxyConfig)                  // Self-proxy
  .proxy(target: BuiltPlugin, config: ProxyConfig)  // Single plugin
  .proxy('*', config: ProxyConfig)             // All dependencies
  .proxy('**', config: ProxyConfig)            // All plugins
  .onInit(hook: (ctx) => void)
  .onReady(hook: (ctx) => void)
  .onShutdown(hook: (ctx) => void)
  .onError(hook: (ctx) => void)
  .setup(fn: (ctx) => api)
```

### Creating Kernel

```typescript
createKernel()
  .use(plugin: BuiltPlugin)
  .withConfig(config: Partial<KernelConfig>)
  .proxy(target: BuiltPlugin, config: ProxyConfig)
  .proxy('**', config: ProxyConfig)
  .build()
  .start()
```

### Using Kernel

```typescript
kernel.get(name: string)      // Get plugin API
kernel.shutdown()             // Shutdown all plugins
```

---

## 🧪 Testing

```typescript
import { createKernel, plugin } from '@zern/kernel';

describe('MyPlugin', () => {
  it('should work correctly', async () => {
    const kernel = await createKernel().use(myPlugin).start();

    const api = kernel.get('myPlugin');
    expect(api.myMethod()).toBe('expected');

    await kernel.shutdown();
  });
});
```

---

## 🤝 Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md) before submitting pull requests.

---

## 📄 License

MIT © [ZernJS](https://github.com/zernjs)

---

<div align="center">

**[⬆ Back to Top](#-zern-kernel)**

Made with ❤️ by the Zern Team

</div>
