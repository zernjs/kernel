# Proxy System

> **Intercepting and modifying plugin method behavior at runtime**

The Proxy System allows plugins to intercept method calls on other plugins, enabling cross-cutting concerns like logging, caching, validation, timing, and error handling without modifying the original implementation.

---

## 📦 Overview

**Location:** `src/extension/proxy-types.ts`, `src/extension/extension.ts`

**Key Components:**

- `ProxyConfig` - Configuration for method interception
- `ProxyContext` - Runtime context provided to interceptors
- `ProxyMetadata` - Internal storage for registered proxies
- Helper methods - `skip()`, `replace()`, `modifyArgs()`

**Capabilities:**

- ✅ Intercept individual methods or all methods
- ✅ Execute code before, after, around, and on error
- ✅ Skip execution or replace results
- ✅ Modify arguments dynamically
- ✅ Priority-based execution order
- ✅ Conditional proxies with filters
- ✅ Full type safety with automatic inference

---

## 🎯 Basic Proxy Usage

### Intercepting a Single Method

```typescript
const loggingPlugin = plugin('logging', '1.0.0')
  .proxy(mathPlugin, {
    methods: 'add', // Intercept only the 'add' method
    before: ctx => {
      console.log(`[LOG] Calling ${ctx.method} with args:`, ctx.args);
    },
    after: (result, ctx) => {
      console.log(`[LOG] ${ctx.method} returned:`, result);
      return result;
    },
  })
  .setup(() => ({}));
```

### Intercepting Multiple Methods

```typescript
const validationPlugin = plugin('validation', '1.0.0')
  .proxy(mathPlugin, {
    methods: ['add', 'subtract', 'multiply'], // Array of method names
    before: ctx => {
      // Validate all arguments are numbers
      for (const arg of ctx.args) {
        if (typeof arg !== 'number') {
          throw new TypeError(`Expected number, got ${typeof arg}`);
        }
      }
    },
  })
  .setup(() => ({}));
```

### Intercepting All Methods

```typescript
const timingPlugin = plugin('timing', '1.0.0')
  .proxy(apiPlugin, ctx => ({
    // ✨ Factory function - ctx is shared between all interceptors!
    before: () => {
      ctx.data.startTime = Date.now();
      console.log(`⏱️  [TIMING] Starting ${ctx.method}...`);
    },
    after: result => {
      const duration = Date.now() - (ctx.data.startTime as number);
      console.log(`⏱️  [TIMING] ${ctx.method} took ${duration}ms`);
      return result;
    },
  }))
  .setup(() => ({}));
```

---

## 🎯 Proxy Targets

Zern Kernel provides **4 different ways** to target proxies, offering granular control over what gets intercepted.

### 1️⃣ Self-Proxy: Proxy Your Own Methods

A plugin can proxy its own methods, useful for internal validation or logging:

```typescript
const mathPlugin = plugin('math', '1.0.0')
  .setup(() => ({
    add: (a: number, b: number) => a + b,
    multiply: (a: number, b: number) => a * b,
  }))
  .proxy({
    // ✅ No target = self-proxy
    methods: 'add',
    before: ctx => {
      console.log(`[MATH] Self-proxying ${ctx.method}`);
    },
  });
```

**Use cases:** Internal validation, debugging, performance monitoring of own methods.

### 2️⃣ Single Plugin Proxy: Proxy Specific Plugin

Proxy another plugin's methods (plugin must be declared as dependency):

```typescript
const loggingPlugin = plugin('logging', '1.0.0')
  .depends(mathPlugin, '^1.0.0') // ✅ Required!
  .proxy(mathPlugin, {
    // ✅ Target specific plugin
    methods: 'add',
    before: ctx => {
      console.log(`[LOG] Proxying ${ctx.pluginName}.${ctx.method}`);
    },
  })
  .setup(() => ({}));
```

**Validation:** If `mathPlugin` is not in `.depends()`, an error is thrown.

**Use cases:** Logging, monitoring, or extending specific plugins.

### 3️⃣ Dependencies Proxy: Proxy All Dependencies

Proxy **all** plugins declared as dependencies using the `'*'` symbol:

```typescript
const timingPlugin = plugin('timing', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .depends(apiPlugin, '^1.0.0')
  .proxy('*', {
    // ✅ '*' = all dependencies
    before: ctx => {
      console.log(`[TIMING] ${ctx.pluginName}.${ctx.method} started`);
    },
  })
  .setup(() => ({}));

// Proxies both mathPlugin AND apiPlugin
```

**Use cases:** Global timing, logging, or monitoring for all dependencies.

### 4️⃣ Global Proxy: Proxy All Plugins

Proxy **every plugin** in the kernel using the `'**'` symbol:

```typescript
const globalMonitorPlugin = plugin('global-monitor', '1.0.0')
  .proxy('**', {
    // ✅ '**' = ALL plugins in kernel
    priority: 100,
    before: ctx => {
      console.log(`[GLOBAL] ${ctx.pluginName}.${ctx.method}()`);
    },
  })
  .setup(() => ({}));

// Proxies EVERY plugin registered in the kernel
```

**Use cases:** Global telemetry, debugging, security audits.

---

## 🏗️ Kernel-Level Proxies

The **kernel itself** can also register proxies via `createKernel().proxy()`. This is useful when the application (not a plugin) needs to intercept plugin behavior.

### Single Plugin Proxy (from Kernel)

```typescript
const kernel = await createKernel()
  .use(mathPlugin)
  .use(apiPlugin)
  // ✅ Kernel proxies a specific plugin
  .proxy(mathPlugin, {
    before: ctx => {
      console.log(`[KERNEL] Intercepting ${ctx.pluginName}.${ctx.method}`);
    },
  })
  .start();
```

### Global Proxy (from Kernel)

```typescript
const kernel = await createKernel()
  .use(mathPlugin)
  .use(apiPlugin)
  .use(dbPlugin)
  // ✅ Kernel proxies ALL plugins
  .proxy('**', {
    priority: 100,
    before: ctx => {
      console.log(`[KERNEL-GLOBAL] ${ctx.pluginName}.${ctx.method}() called`);
    },
  })
  .start();
```

### Multiple Kernel Proxies

You can call `.proxy()` multiple times to register different proxies:

```typescript
const kernel = await createKernel()
  .use(mathPlugin)
  .use(apiPlugin)
  // Global timing proxy
  .proxy('**', ctx => {
    let startTime: number;
    return {
      priority: 50,
      before: () => {
        startTime = Date.now();
      },
      after: result => {
        console.log(`Duration: ${Date.now() - startTime}ms`);
        return result;
      },
    };
  })
  // Specific auth proxy for API
  .proxy(apiPlugin, {
    priority: 100,
    include: ['create*', 'update*', 'delete*'],
    before: ctx => {
      checkPermissions(ctx.method);
    },
  })
  .start();
```

**Key Differences:**

- **Plugin proxies:** Registered via `plugin().proxy()`, tied to the plugin lifecycle
- **Kernel proxies:** Registered via `createKernel().proxy()`, applied at kernel initialization

**Use cases for kernel proxies:**

- Application-level logging/monitoring
- Security policies enforced by the app (not plugins)
- Performance profiling of the entire system

---

## 🔄 Interceptor Types

### Before Interceptor

Executes **before** the original method. Can modify arguments, skip execution, or set up context.

```typescript
.proxy(apiPlugin, {
  before: ctx => {
    console.log(`Calling ${ctx.method} with:`, ctx.args);
    // Optionally modify args, skip execution, etc.
  },
})
```

**Use Cases:**

- Logging method calls
- Validating input
- Modifying arguments
- Setting up timing/tracking
- Canceling execution conditionally

### After Interceptor

Executes **after** the original method. Can transform results or log output.

```typescript
.proxy(apiPlugin, {
  after: (result, ctx) => {
    console.log(`${ctx.method} returned:`, result);
    return result * 2; // Transform result!
  },
})
```

**Use Cases:**

- Transforming return values
- Logging results
- Caching results
- Post-processing data

### Around Interceptor

Complete control **around** the original method. You manually call the original or skip it entirely.

```typescript
.proxy(apiPlugin, {
  around: async (ctx, next) => {
    const cacheKey = JSON.stringify(ctx.args);

    // Check cache
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey); // Skip original!
    }

    // Execute original
    const result = await next();
    cache.set(cacheKey, result);

    return result;
  },
})
```

**Use Cases:**

- Caching
- Retry logic
- Performance measurement
- Conditional execution
- Error handling with try/catch

### Error Interceptor

Handles errors from the original method.

```typescript
.proxy(apiPlugin, {
  onError: (error, ctx) => {
    console.error(`❌ [ERROR] ${ctx.method} failed:`, error.message);

    // Return fallback value for read operations
    if (ctx.method.startsWith('get')) {
      return null;
    }

    // Re-throw for destructive operations
    throw error;
  },
})
```

**Use Cases:**

- Error logging
- Fallback values
- Error transformation
- Graceful degradation

---

## 🎨 Method Selection

### Select by Method Name

```typescript
.proxy(apiPlugin, {
  methods: 'getUser', // Single method
})

.proxy(apiPlugin, {
  methods: ['create', 'update', 'delete'], // Multiple methods
})
```

### Include Patterns (Glob-style)

```typescript
.proxy(apiPlugin, {
  include: ['get*', 'fetch*'], // All methods starting with get or fetch
})

.proxy(apiPlugin, {
  include: ['*User', '*Data'], // All methods ending with User or Data
})
```

### Exclude Patterns

```typescript
.proxy(apiPlugin, {
  exclude: ['*Internal', 'configure'], // Exclude internal methods
})

.proxy(apiPlugin, {
  include: ['*'], // All methods
  exclude: ['getConfig', 'setConfig'], // Except these
})
```

### Combining Filters

```typescript
.proxy(apiPlugin, {
  methods: ['create', 'update', 'delete'], // Only these methods
  exclude: ['deleteInternal'], // But not this one
})
```

---

## 🎭 Proxy Context

The `ProxyContext` provides comprehensive information about the method call, access to stores, and helper methods:

```typescript
interface ProxyContext<TMethod, TStore, TPlugins> {
  // Basic information
  readonly pluginName: string; // Plugin name being proxied
  readonly method: string; // Method name being called
  readonly args: Parameters<TMethod>; // Method arguments (typed!)

  // Store access
  readonly store: Store<TStore>; // YOUR plugin's store (who is doing the proxy)
  readonly plugins: TPlugins; // Access to target plugin(s) with $store and $meta

  // Helper methods
  skip: () => void; // Skip method execution
  replace: (result) => void; // Replace result
  modifyArgs: (...args) => void; // Modify arguments
}
```

### Store Access

#### Your Plugin's Store (`ctx.store`)

Access YOUR plugin's store (the one registering the proxy):

```typescript
const loggingPlugin = plugin('logging', '1.0.0')
  .store(() => ({ logCount: 0, logs: [] }))
  .depends(mathPlugin, '^1.0.0')
  .proxy(mathPlugin, {
    before: ctx => {
      // ✅ Access YOUR store (loggingPlugin's store)
      ctx.store.logCount++;
      ctx.store.logs.push(`Calling ${ctx.method}`);

      // ✅ Use ALL Store methods
      ctx.store.watch('logCount', change => {
        console.log(`Log count: ${change.newValue}`);
      });

      ctx.store.batch(() => {
        ctx.store.logCount++;
        ctx.store.logs.push('Batch operation');
      });
    },
  })
  .setup(() => ({}));
```

#### Target Plugin's Store (`ctx.plugins.<name>.$store`)

Access the target plugin's store and metadata:

```typescript
const loggerPlugin = plugin('logger', '1.0.0')
  .store(() => ({ logs: [] }))
  .depends(mathPlugin, '^1.0.0')
  .proxy(mathPlugin, {
    before: ctx => {
      // ✅ Access target plugin's API
      const result = ctx.plugins.math.add(1, 2);

      // ✅ Access target plugin's store (full Store object!)
      ctx.plugins.math.$store.callCount++;

      // ✅ Use ALL Store methods on target store
      ctx.plugins.math.$store.watch('callCount', change => {
        console.log(`Math called ${change.newValue} times`);
      });

      // ✅ Access target plugin's metadata
      console.log(`Plugin: ${ctx.plugins.math.$meta.name}`);
      console.log(`Version: ${ctx.plugins.math.$meta.version}`);
      console.log(`Author: ${ctx.plugins.math.$meta.author}`);
    },
  })
  .setup(() => ({}));
```

### Complete Store Methods Available

Both `ctx.store` and `ctx.plugins.<name>.$store` expose the **full Store API**:

- **Watchers:** `watch()`, `watchAll()`, `watchBatch()`, `unwatch()`
- **Batch Operations:** `batch()`, `transaction()`
- **Computed Values:** `computed()`, `select()`
- **History:** `getHistory()`, `clearHistory()`, `undo()`, `redo()`, `reset()`
- **Utilities:** `getMetrics()`, `clearWatchers()`

### Helper Methods

#### `ctx.skip()`

Skip the original method execution:

```typescript
.proxy(apiPlugin, {
  before: ctx => {
    if (!isAuthenticated()) {
      ctx.skip(); // Original method won't execute
      throw new Error('Unauthorized');
    }
  },
})
```

#### `ctx.replace(result)`

Skip execution and provide a custom result:

```typescript
.proxy(apiPlugin, {
  before: ctx => {
    const cached = cache.get(ctx.method);
    if (cached) {
      ctx.replace(cached); // Return cached value instead
    }
  },
})
```

#### `ctx.modifyArgs(...args)`

Modify the arguments before calling the original method:

```typescript
.proxy(mathPlugin, {
  before: ctx => {
    // Normalize negative numbers to positive
    const normalized = ctx.args.map(n => Math.abs(n));
    ctx.modifyArgs(...normalized);
  },
})
```

### Shared Data Between Interceptors

Use **factory function pattern** with closures for type-safe data sharing:

```typescript
.proxy(apiPlugin, ctx => {
  // ✅ Use closure for type-safe sharing
  let startTime: number;
  let userId: string;

  return {
    before: () => {
      startTime = Date.now();
      userId = getCurrentUser();
    },
    after: (result) => {
      const duration = Date.now() - startTime; // ✅ Type-safe!
      log(`User ${userId} - Duration: ${duration}ms`);
      return result;
    },
  };
})
```

> **💡 Tip:** Factory function pattern provides better type safety than using `ctx.data`!

---

## ⚙️ Advanced Features

### Priority

Control execution order when multiple proxies target the same method:

```typescript
const authPlugin = plugin('auth', '1.0.0')
  .proxy(apiPlugin, {
    priority: 100, // Execute FIRST (higher priority)
    before: ctx => {
      if (!isAuthenticated()) throw new Error('Unauthorized');
    },
  })
  .setup(() => ({}));

const loggingPlugin = plugin('logging', '1.0.0')
  .proxy(apiPlugin, {
    priority: 50, // Execute AFTER auth (lower priority)
    before: ctx => {
      console.log(`Calling ${ctx.method}`);
    },
  })
  .setup(() => ({}));
```

**Default Priority:** `50`

### Conditional Proxies

Execute proxy only when a condition is met:

```typescript
.proxy(apiPlugin, {
  condition: ctx => ctx.method.startsWith('delete'),
  before: ctx => {
    console.log(`⚠️  Destructive operation: ${ctx.method}`);
  },
})
```

### Grouping

Group related proxies for better organization:

```typescript
.proxy(apiPlugin, {
  group: 'security',
  before: ctx => {
    /* security check */
  },
})

.proxy(apiPlugin, {
  group: 'security',
  after: (result, ctx) => {
    /* security logging */
  },
})
```

---

## 🔍 Complete Examples

### Caching Proxy

```typescript
const cache = new Map<string, any>();

const cachePlugin = plugin('cache', '1.0.0')
  .proxy(apiPlugin, {
    include: ['get*'], // Only cache read operations
    priority: 90,
    around: async (ctx, next) => {
      const cacheKey = `${ctx.method}:${JSON.stringify(ctx.args)}`;

      if (cache.has(cacheKey)) {
        console.log(`💾 [CACHE] Hit for ${ctx.method}`);
        return cache.get(cacheKey);
      }

      console.log(`💾 [CACHE] Miss for ${ctx.method}`);
      const result = await next();
      cache.set(cacheKey, result);

      return result;
    },
  })
  .setup(() => ({}));
```

### Authentication & Authorization

```typescript
const authPlugin = plugin('auth', '1.0.0')
  .proxy(apiPlugin, {
    include: ['delete*', 'update*', 'create*'],
    priority: 100,
    before: ctx => {
      console.log(`🔐 [AUTH] Checking permissions for ${ctx.method}...`);

      const isAuthenticated = checkAuth();
      if (!isAuthenticated) {
        ctx.skip();
        throw new Error('Unauthorized');
      }

      console.log(`✅ [AUTH] Permission granted`);
    },
  })
  .setup(() => ({}));
```

### Validation Proxy

```typescript
const validationPlugin = plugin('validation', '1.0.0')
  .proxy(mathPlugin, {
    include: ['*'], // All methods
    priority: 100,
    before: ctx => {
      for (const arg of ctx.args) {
        if (typeof arg !== 'number' || !Number.isFinite(arg)) {
          throw new Error(`Invalid argument: ${arg}`);
        }
      }
    },
  })
  .setup(() => ({}));
```

### Retry Logic

```typescript
const retryPlugin = plugin('retry', '1.0.0')
  .proxy(apiPlugin, {
    include: ['fetch*'],
    around: async (ctx, next) => {
      const maxRetries = 3;
      let lastError;

      for (let i = 0; i < maxRetries; i++) {
        try {
          return await next();
        } catch (error) {
          lastError = error;
          console.log(`Retry ${i + 1}/${maxRetries}`);
          await sleep(1000 * (i + 1)); // Exponential backoff
        }
      }

      throw lastError;
    },
  })
  .setup(() => ({}));
```

---

## ✅ Best Practices

### 1. Use Proxies for Cross-Cutting Concerns

✅ **Good** - Logging, timing, caching, validation:

```typescript
.proxy(plugin, {
  before: ctx => console.log(`Calling ${ctx.method}`),
})
```

❌ **Bad** - Business logic in proxies:

```typescript
.proxy(plugin, {
  before: ctx => {
    // Don't put business logic here!
    const discount = calculateComplexDiscount(ctx.args);
  },
})
```

### 2. Keep Interceptors Simple

✅ **Good:**

```typescript
.proxy(plugin, {
  before: ctx => {
    console.log(`Called: ${ctx.method}`);
  },
})
```

❌ **Bad:**

```typescript
.proxy(plugin, {
  before: async ctx => {
    // Too complex!
    await validateWithExternalAPI(ctx.args);
    await checkPermissions(ctx.userId);
    await logToDatabase(ctx);
    await sendNotification(ctx);
  },
})
```

### 3. Use Priority Wisely

✅ **Good:**

```typescript
// Auth first (high priority)
.proxy(plugin, { priority: 100, before: authCheck })

// Then logging (medium priority)
.proxy(plugin, { priority: 50, before: log })

// Then caching (low priority)
.proxy(plugin, { priority: 10, around: cache })
```

### 4. Document Proxy Behavior

✅ **Good:**

```typescript
/**
 * Adds caching to expensive calculations
 * Cache TTL: 60 seconds
 * Cache key: JSON.stringify(args)
 */
const cachingPlugin = plugin('caching', '1.0.0')
  .proxy(plugin, { ... })
  .setup(() => ({}));
```

### 5. Use Factory Functions for Type-Safe Data

✅ **Good:**

```typescript
.proxy(apiPlugin, ctx => {
  // Use closure for type-safe sharing
  let startTime: number;

  return {
    before: () => {
      startTime = Date.now(); // ✅ Type-safe!
    },
    after: result => {
      const duration = Date.now() - startTime; // ✅ No casting needed!
      return result;
    },
  };
})
```

❌ **Acceptable (but less type-safe):**

```typescript
.proxy(apiPlugin, {
  before: ctx => {
    ctx.data.startTime = Date.now(); // Runtime type is 'any'
  },
  after: (result, ctx) => {
    const duration = Date.now() - (ctx.data.startTime as number); // Casting needed
    return result;
  },
})
```

---

## 🔐 Type Safety

### Automatic Type Inference

```typescript
// Proxy automatically infers method signature!
.proxy(mathPlugin, {
  methods: 'add',
  before: ctx => {
    // ctx.args is inferred as [number, number]
    const [a, b] = ctx.args; // ✅ Type-safe!
  },
  after: result => {
    // result is inferred as number
    return result * 2; // ✅ Type-safe!
  },
})
```

### Factory Function for Shared Context

```typescript
.proxy(apiPlugin, ctx => {
  // Shared variables with proper types
  let requestId: string;
  let startTime: number;

  return {
    before: () => {
      requestId = generateId();
      startTime = Date.now();
    },
    after: result => {
      const duration = Date.now() - startTime; // ✅ No casting!
      log(`Request ${requestId} took ${duration}ms`);
      return result;
    },
  };
})
```

---

## 📊 Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│                 PROXY EXECUTION FLOW                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Sort proxies by priority (highest first)            │
│     ↓                                                   │
│  2. Execute BEFORE interceptors (in priority order)     │
│     ↓                                                   │
│  3. Check if execution was skipped (ctx.skip())         │
│     ↓                                                   │
│  4. Apply modified args (ctx.modifyArgs())              │
│     ↓                                                   │
│  5. Execute AROUND interceptor (if exists)              │
│     OR                                                  │
│     Execute original method                             │
│     ↓                                                   │
│  6. Execute AFTER interceptors (in priority order)      │
│     ↓                                                   │
│  7. Return final result                                 │
│                                                         │
│  ON ERROR: Execute onError interceptors                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🆚 Proxy vs Extension

| Feature      | Proxy                             | Extension            |
| ------------ | --------------------------------- | -------------------- |
| **Purpose**  | Intercept existing methods        | Add new methods      |
| **Modifies** | Behavior                          | API surface          |
| **When**     | Runtime (around existing methods) | Build time           |
| **Use For**  | Logging, caching, validation      | Adding functionality |

**Example:**

```typescript
// Extension: Adds NEW methods
.extend(mathPlugin, api => ({
  power: (base, exp) => Math.pow(base, exp), // ✅ New method
}))

// Proxy: Intercepts EXISTING methods
.proxy(mathPlugin, {
  methods: 'add',
  before: ctx => console.log('add called'), // ✅ Intercepts existing
})
```

---

## 📚 Next Steps

Now that you understand the Proxy System, you can:

- Explore [Extension System](./05-extension-system.md) for adding new methods
- Review [Best Practices](./10-best-practices.md) for recommended patterns
- Check [API Reference](./09-api-reference.md) for complete API details

---

[← Back to Index](./README.md) | [Next: Best Practices →](./10-best-practices.md)
