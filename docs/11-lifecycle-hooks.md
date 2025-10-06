# 11. Lifecycle Hooks

**Lifecycle hooks** allow plugins to execute code at specific points during their lifecycle: initialization, ready state, shutdown, and error handling. This enables proper resource management, logging, and graceful cleanup.

---

## Overview

Zern Kernel provides four lifecycle hooks:

| Hook         | When Executed                          | Use Cases                                        |
| ------------ | -------------------------------------- | ------------------------------------------------ |
| `onInit`     | Before `setup()` is called             | Pre-initialization tasks, resource allocation    |
| `onReady`    | After plugin is fully initialized      | Post-initialization tasks, start background jobs |
| `onShutdown` | During kernel shutdown (reverse order) | Resource cleanup, connection closing             |
| `onError`    | When plugin initialization fails       | Error logging, recovery attempts                 |

---

## Hook Context

All hooks receive a `LifecycleHookContext`:

```typescript
interface LifecycleHookContext<TDeps> {
  readonly pluginName: string;
  readonly pluginId: PluginId;
  readonly kernel: KernelContext;
  readonly plugins: TDeps; // ✨ Type-safe dependencies with metadata!
}
```

**Available Data:**

- `pluginName` - The plugin's name
- `pluginId` - The plugin's unique ID
- `kernel` - Kernel context for accessing other plugins
- `plugins` - **Type-safe dependencies** with full API and metadata access

### Accessing Dependencies in Hooks

Dependencies are available through the `plugins` object with full type safety:

```typescript
const analyticsPlugin = plugin('analytics', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .onInit(({ pluginName, plugins }) => {
    // ✅ Access logger API with autocomplete
    plugins.logger.log(`[${pluginName}] Initializing...`);

    // ✅ Access database API
    plugins.database.connect();
  })
  .setup(() => ({
    /* API */
  }));
```

### Accessing Metadata via `$meta`

Each dependency includes a `$meta` property with plugin metadata:

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .metadata({
    author: 'Zern Team',
    category: 'data',
    connectionString: 'postgresql://localhost:5432/mydb',
  })
  .setup(() => ({
    /* API */
  }));

const analyticsPlugin = plugin('analytics', '1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .onInit(({ plugins }) => {
    // ✅ Access custom metadata
    console.log(plugins.database.$meta.author); // "Zern Team"
    console.log(plugins.database.$meta.connectionString); // "postgresql://..."

    // ✅ Access standard metadata
    console.log(plugins.database.$meta.name); // "database"
    console.log(plugins.database.$meta.version); // Version object
    console.log(plugins.database.$meta.id); // PluginId
  })
  .setup(() => ({
    /* API */
  }));
```

**Standard Metadata Properties (always available):**

- `name` - Plugin name (string)
- `version` - Plugin version (Version object)
- `id` - Plugin ID (PluginId)
- Plus all custom metadata from `.metadata()`

---

## onInit Hook

Executes **before** the plugin's `setup()` function.

### Signature

```typescript
onInit(hook: (context: LifecycleHookContext) => void | Promise<void>): PluginBuilder
```

### Example

```typescript
const loggerPlugin = plugin('logger', '1.0.0')
  .onInit(({ pluginName }) => {
    console.log(`[${pluginName}] Initializing...`);
  })
  .setup(() => ({
    log: (msg: string) => console.log(msg),
  }));
```

### Use Cases

- ✅ Allocating resources
- ✅ Pre-initialization logging
- ✅ Setting up connections
- ✅ Loading configuration

---

## onReady Hook

Executes **after** the plugin is fully initialized (including extensions).

### Signature

```typescript
onReady(hook: (context: LifecycleHookContext) => void | Promise<void>): PluginBuilder
```

### Example

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .onReady(async ({ pluginName, kernel }) => {
    console.log(`[${pluginName}] Database ready!`);
    console.log(`Kernel ID: ${kernel.id}`);
  })
  .setup(() => ({
    query: async (sql: string) => {
      /* ... */
    },
  }));
```

### Use Cases

- ✅ Starting background tasks
- ✅ Sending ready signals
- ✅ Logging successful initialization
- ✅ Accessing other plugins via kernel

---

## onShutdown Hook

Executes during kernel shutdown, **in reverse initialization order**.

### Signature

```typescript
onShutdown(hook: (context: LifecycleHookContext) => void | Promise<void>): PluginBuilder
```

### Example

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .onShutdown(async ({ pluginName }) => {
    console.log(`[${pluginName}] Closing connections...`);
    await closeConnections();
  })
  .setup(() => ({
    /* API */
  }));

// Later...
await kernel.shutdown(); // Triggers onShutdown hooks
```

### Use Cases

- ✅ Closing database connections
- ✅ Flushing buffers/caches
- ✅ Stopping background tasks
- ✅ Releasing resources

---

## onError Hook

Executes when **any error occurs** in the plugin - during initialization, setup, lifecycle hooks, or runtime method calls.

### Signature

```typescript
onError(
  hook: (error: Error, context: LifecycleHookContext) => void | Promise<void>
): PluginBuilder
```

### Error Context

The context includes a `phase` field indicating where the error occurred:

```typescript
interface LifecycleHookContext {
  pluginName: string;
  pluginId: PluginId;
  kernel: KernelContext;
  plugins: TDeps;
  store: Store<TStore>;

  phase: 'init' | 'setup' | 'ready' | 'shutdown' | 'runtime';
  method?: string; // Present when phase === 'runtime'
}
```

### Examples

#### Capturing Initialization Errors

```typescript
const apiPlugin = plugin('api', '1.0.0')
  .onError((error, { pluginName, phase }) => {
    if (phase === 'init' || phase === 'setup') {
      console.error(`[${pluginName}] Initialization failed:`, error.message);
      trackError({ plugin: pluginName, error });
    }
  })
  .setup(() => {
    throw new Error('API initialization failed!');
  });
```

#### Capturing Runtime Errors

```typescript
const userPlugin = plugin('user', '1.0.0')
  .setup(() => ({
    getUser: (id: string) => {
      if (!users.has(id)) {
        throw new UserNotFoundError(id);
      }
      return users.get(id);
    },
  }))
  .onError((error, { phase, method }) => {
    // ✅ Captures errors from method calls!
    if (phase === 'runtime') {
      console.error(`[${method}] Runtime error:`, error.message);

      // Track which methods are failing
      metrics.increment('method_errors', {
        plugin: 'user',
        method,
      });
    }
  });

// Later, when calling methods:
const user = kernel.get('user');
user.getUser('invalid-id'); // Triggers onError with phase='runtime', method='getUser'
```

#### Comprehensive Error Handling

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .setup(() => ({
    query: async (sql: string) => {
      // This error will be caught by onError
      throw new QueryError(sql);
    },
  }))
  .onError((error, ctx) => {
    // Handle all error types
    switch (ctx.phase) {
      case 'init':
        console.error(`[INIT] ${error.message}`);
        notifyAdmins('Database init failed');
        break;

      case 'runtime':
        console.error(`[${ctx.method}] Query failed:`, error.message);
        logger.error({
          plugin: ctx.pluginName,
          method: ctx.method,
          error: error.message,
        });
        break;

      case 'shutdown':
        console.error(`[SHUTDOWN] Cleanup failed:`, error.message);
        break;
    }
  });
```

### Use Cases

- ✅ Logging errors from any phase
- ✅ Sending to error tracking services (Sentry, Datadog, etc.)
- ✅ Tracking method-level failures
- ✅ Recovery attempts
- ✅ Notifying administrators
- ✅ Collecting error metrics
- ✅ Custom error handling per plugin

---

## Complete Example

```typescript
const databasePlugin = plugin('database', '1.0.0')
  .onInit(async ({ pluginName }) => {
    console.log(`[${pluginName}] Allocating connection pool...`);
    await allocatePool();
  })
  .onReady(async ({ pluginName, kernel }) => {
    console.log(`[${pluginName}] Database ready for queries!`);
    console.log(`Kernel: ${kernel.id}`);
  })
  .onShutdown(async ({ pluginName }) => {
    console.log(`[${pluginName}] Closing all connections...`);
    await closeAllConnections();
  })
  .onError((error, { pluginName }) => {
    console.error(`[${pluginName}] Failed to initialize:`, error);
    notifyAdmin(error);
  })
  .setup(() => ({
    query: async (sql: string) => {
      /* Execute query */
    },
  }));
```

---

## Execution Order

### During Initialization

1. Plugins are initialized in **dependency order**
2. For each plugin:
   - `onInit` hook is called
   - `setup()` function is called
   - Extensions are applied
   - `onReady` hook is called

**Example Flow:**

```
Plugin A (no deps)
  → onInit → setup → extensions → onReady

Plugin B (depends on A)
  → onInit → setup → extensions → onReady

Plugin C (depends on B)
  → onInit → setup → extensions → onReady
```

### During Shutdown

Plugins are shut down in **reverse order**:

```
Plugin C → onShutdown
Plugin B → onShutdown
Plugin A → onShutdown
```

---

## Accessing Other Plugins

Hooks receive the kernel context, allowing access to other plugins:

```typescript
const analyticsPlugin = plugin('analytics', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .onReady(({ kernel }) => {
    const logger = kernel.get('logger');
    logger.log('Analytics initialized!');
  })
  .setup(({ plugins }) => ({
    track: (event: string) => {
      plugins.logger.log(`Event: ${event}`);
    },
  }));
```

**⚠️ Important:** Only access plugins that are declared as dependencies!

---

## Async Hooks

All hooks support async operations:

```typescript
const servicePlugin = plugin('service', '1.0.0')
  .onInit(async ({ pluginName }) => {
    console.log(`[${pluginName}] Connecting...`);
    await connectToService();
    console.log(`[${pluginName}] Connected!`);
  })
  .onShutdown(async ({ pluginName }) => {
    console.log(`[${pluginName}] Disconnecting...`);
    await disconnectFromService();
    console.log(`[${pluginName}] Disconnected!`);
  })
  .setup(() => ({
    /* API */
  }));
```

**The kernel waits for async hooks to complete before proceeding.**

---

## Best Practices

### 1. Use onInit for Resource Allocation

✅ **Good:**

```typescript
.onInit(async () => {
  await allocateResources();
})
```

❌ **Bad:**

```typescript
.setup(() => {
  allocateResources(); // Side effects in setup!
  return { /* API */ };
})
```

### 2. Use onShutdown for Cleanup

✅ **Good:**

```typescript
.onShutdown(async () => {
  await closeConnections();
  await flushBuffers();
})
```

### 3. Handle Errors Gracefully

✅ **Good:**

```typescript
.onError((error, { pluginName }) => {
  console.error(`[${pluginName}] Error:`, error);
  trackError(error);
})
```

### 4. Don't Throw in Hooks

❌ **Bad:**

```typescript
.onShutdown(() => {
  throw new Error('Shutdown failed!'); // Don't throw!
})
```

✅ **Good:**

```typescript
.onShutdown(async () => {
  try {
    await cleanup();
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
})
```

### 5. Keep Hooks Focused

✅ **Good:** Each hook has a single responsibility

```typescript
.onInit(async () => {
  await allocatePool();
})
.onReady(() => {
  console.log('Ready!');
})
.onShutdown(async () => {
  await closePool();
})
```

❌ **Bad:** Mixing concerns

```typescript
.onInit(async () => {
  await allocatePool();
  console.log('Ready!');
  setupShutdownHandler();
})
```

---

## Common Patterns

### 1. Database Connection Management

```typescript
const dbPlugin = plugin('db', '1.0.0')
  .onInit(async () => {
    await db.connect();
  })
  .onShutdown(async () => {
    await db.disconnect();
  })
  .setup(() => ({
    query: (sql: string) => db.query(sql),
  }));
```

### 2. Background Task Management

```typescript
let intervalId: NodeJS.Timeout;

const backgroundPlugin = plugin('background', '1.0.0')
  .onReady(() => {
    intervalId = setInterval(() => {
      console.log('Background task running...');
    }, 5000);
  })
  .onShutdown(() => {
    clearInterval(intervalId);
  })
  .setup(() => ({
    /* API */
  }));
```

### 3. Logging with Dependencies

```typescript
const monitorPlugin = plugin('monitor', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .onInit(({ kernel }) => {
    kernel.get('logger').log('Monitor starting...');
  })
  .onReady(({ kernel }) => {
    kernel.get('logger').log('Monitor ready!');
  })
  .onShutdown(({ kernel }) => {
    kernel.get('logger').log('Monitor stopping...');
  })
  .setup(({ plugins }) => ({
    check: () => plugins.logger.log('Health check OK'),
  }));
```

---

## Troubleshooting

### Hook Not Executing

**Problem:** Hook doesn't run.

**Solution:** Ensure you're calling `.start()` on the kernel:

```typescript
await createKernel().use(myPlugin).start(); // ✅ Hooks will run
```

### Async Hook Timeout

**Problem:** Hook takes too long.

**Solution:** Increase the initialization timeout:

```typescript
await createKernel()
  .use(myPlugin)
  .config({
    initializationTimeout: 60000, // 60 seconds
  })
  .start();
```

### Can't Access Plugin in Hook

**Problem:** `kernel.get()` throws error.

**Solution:** Only access plugins declared as dependencies:

```typescript
.depends(otherPlugin, '^1.0.0') // ✅ Declare dependency first
.onReady(({ kernel }) => {
  kernel.get('other'); // ✅ Now accessible
})
```

---

## Summary

| Hook         | When                  | Use For             |
| ------------ | --------------------- | ------------------- |
| `onInit`     | Before setup          | Resource allocation |
| `onReady`    | After initialization  | Post-init tasks     |
| `onShutdown` | During shutdown       | Cleanup             |
| `onError`    | On initialization err | Error handling      |

**Key Points:**

- ✅ All hooks are optional
- ✅ Hooks support async operations
- ✅ Hooks receive kernel context
- ✅ Shutdown runs in reverse order
- ✅ Keep hooks focused and simple

---

**Next: [Best Practices](10-best-practices.md)** | **Previous: [API Reference](09-api-reference.md)**
