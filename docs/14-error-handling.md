# Error Handling System

**Zern Kernel** provides a powerful, type-safe error handling system that makes errors explicit, debuggable, and actionable.

---

## 📚 Table of Contents

- [Overview](#-overview)
- [Error Hierarchy](#-error-hierarchy)
- [Creating Custom Errors](#-creating-custom-errors)
- [Error Configuration](#-error-configuration)
- [Global Error Handling](#-global-error-handling)
- [Error Display & Formatting](#-error-display--formatting)
- [Helper Functions](#-helper-functions)
- [Error Matching](#-error-matching)
- [Best Practices](#-best-practices)
- [Integration with Plugins](#-integration-with-plugins)
- [Example Plugins](#-example-plugins)

---

## 🎯 Overview

Zern's error handling system provides:

- **Hierarchical error types** for clear categorization
- **Rich error context** with automatic capture (file, line, method)
- **Actionable solutions** embedded in errors
- **Severity levels** (INFO, WARN, ERROR, FATAL)
- **Beautiful formatting** with stack traces and colors
- **Type-safe matching** for error handling
- **Global error hooks** that capture runtime errors

---

## 🏗️ Error Hierarchy

All Zern errors extend from `ZernError`, which provides:

```typescript
abstract class ZernError extends Error {
  abstract readonly code: string;

  severity: ErrorSeverity; // INFO, WARN, ERROR, FATAL
  context: ErrorContext; // Additional error context
  solutions: ErrorSolution[]; // How to fix the error
  timestamp: Date; // When the error occurred
  cause?: Error; // Original error if wrapped
}
```

### Built-in Error Types

#### Plugin Errors

```typescript
PluginError                 // Base for all plugin errors
├── PluginNotFoundError    // Plugin doesn't exist
├── PluginLoadError        // Failed to load plugin
└── PluginDependencyError  // Missing dependency
```

#### Kernel Errors

```typescript
KernelError                    // Base for kernel errors
├── KernelInitializationError  // Kernel failed to start
└── CircularDependencyError    // Circular dependency detected
```

#### Version Errors

```typescript
VersionError                // Base for version errors
└── VersionMismatchError    // Version incompatibility
```

#### Generic Errors

```typescript
ValidationError; // Validation failures
ConfigurationError; // Configuration problems
GenericError; // Catch-all error type
```

---

## 🎨 Creating Custom Errors

### Simple Custom Error

```typescript
import { ZernError, ErrorSeverity, solution } from '@zern/kernel';

class DatabaseConnectionError extends ZernError {
  readonly code = 'DATABASE_CONNECTION_ERROR';

  constructor(context?: { host?: string; port?: number }) {
    super('Failed to connect to database', {
      severity: ErrorSeverity.FATAL,
      context,
      solutions: [
        solution('Check database credentials', 'Verify DATABASE_URL environment variable'),
        solution('Test connectivity', 'Run: ping database-host'),
      ],
    });
  }
}

// Usage
throw new DatabaseConnectionError({ host: 'localhost', port: 5432 });
```

### Error with Defaults

Create errors with sensible defaults that can be overridden:

```typescript
class UserNotFoundError extends ValidationError {
  constructor(userId: string) {
    super(
      { userId }, // Context
      {
        severity: ErrorSeverity.ERROR,
        solutions: [
          solution('Check the user ID', 'The ID might be incorrect'),
          solution('User may have been deleted', 'Check the database'),
        ],
      }
    );
    this.message = `User not found: ${userId}`;
  }
}

// Simple usage with defaults
throw new UserNotFoundError('user-123');

// Override severity if needed
const error = new UserNotFoundError('user-123');
error.severity = ErrorSeverity.FATAL;
throw error;
```

---

## ⚙️ Error Configuration

### Kernel-Level Configuration

Configure error handling for the entire application:

```typescript
import { createKernel, developmentConfig, productionConfig } from '@zern/kernel';

// Development mode (verbose)
const kernel = createKernel().config({
  ...developmentConfig(),
  errors: {
    captureStackTrace: true,
    stackTraceLimit: 20,
    filterInternalFrames: false, // Show everything
    enableColors: true,
    showContext: true,
    showSolutions: true,
    showTimestamp: true,
  },
});

// Production mode (minimal)
const kernel = createKernel().config({
  ...productionConfig(),
  errors: {
    captureStackTrace: false,
    enableColors: false,
    showContext: false,
    showSolutions: false,
  },
});
```

### Plugin-Level Configuration

Override error handling for specific plugins:

```typescript
const mathPlugin = plugin('math', '1.0.0')
  .config({
    errors: {
      showSolutions: true,
      severity: ErrorSeverity.WARN, // Default severity for this plugin
    },
  })
  .setup(() => ({
    divide: (a: number, b: number) => {
      if (b === 0) {
        throw new DivisionByZeroError({ a, b });
      }
      return a / b;
    },
  }));
```

### Configuration Options

```typescript
interface ErrorConfig {
  // Stack trace
  captureStackTrace?: boolean; // Capture stack traces
  stackTraceLimit?: number; // Max frames to show
  filterInternalFrames?: boolean; // Hide Zern internals

  // Display
  enableColors?: boolean; // Terminal colors
  showContext?: boolean; // Show error context
  showSolutions?: boolean; // Show solutions
  showTimestamp?: boolean; // Show when error occurred

  // Defaults
  severity?: ErrorSeverity; // Default error severity
}
```

---

## 🎣 Global Error Handling

The `onError` lifecycle hook captures errors from **any phase** of plugin execution:

### Error Phases

```typescript
type ErrorPhase =
  | 'init' // Error during onInit
  | 'setup' // Error during setup
  | 'ready' // Error during onReady
  | 'shutdown' // Error during onShutdown
  | 'runtime'; // Error when calling plugin methods
```

### Capturing Runtime Errors

```typescript
const apiPlugin = plugin('api', '1.0.0')
  .setup(() => ({
    fetchUser: (userId: string) => {
      if (!userExists(userId)) {
        throw new UserNotFoundError(userId);
      }
      return getUser(userId);
    },
  }))
  .onError((error, ctx) => {
    // ✅ Captures errors from ALL phases including runtime!
    console.log(`[${ctx.phase}] Error in ${ctx.method}:`, error.message);

    if (ctx.phase === 'runtime') {
      // Runtime error - method call failed
      console.log(`Failed method: ${ctx.method}`);

      // Send to error tracking
      trackError(error, {
        plugin: ctx.pluginName,
        method: ctx.method,
      });
    }

    // Perform recovery
    if (error.severity === ErrorSeverity.FATAL) {
      // Notify admins
      notifyAdmins(error);
    }
  });
```

### Complete Error Context

```typescript
interface LifecycleHookContext {
  pluginName: string;
  pluginId: PluginId;
  kernel: KernelContext;
  plugins: TDeps;
  store: Store<TStore>;

  phase: 'init' | 'setup' | 'ready' | 'shutdown' | 'runtime';
  method?: string; // Present when phase = 'runtime'
}
```

---

## 🎨 Error Display & Formatting

Errors are automatically formatted with rich information:

### Example Output

```
────────────────────────────────────────────────────────────────────────────────
❌ ERROR USER_NOT_FOUND

User not found: user-123

Context:
  plugin: api
  method: fetchUser
  phase: runtime
  userId: user-123
  file: api.plugin.ts
  line: 42
  column: 7

Stack Trace:
  → fetchUser
    plugins/api.plugin.ts:42:7
    main
    src/app.ts:15:18

💡 Possible Solutions:
  1. Check the user ID
     The ID might be incorrect

  2. User may have been deleted
     Check the database

────────────────────────────────────────────────────────────────────────────────
```

### Programmatic Error Display

```typescript
import { ErrorHandler } from '@zern/kernel';

const handler = new ErrorHandler({
  enableColors: true,
  showSolutions: true,
  captureStackTrace: true,
});

try {
  // ... code
} catch (error) {
  handler.handle(error);
}
```

---

## 🛠️ Helper Functions

### `solution()`

Create actionable solutions for errors:

```typescript
import { solution } from '@zern/kernel';

solution('Title of the solution', 'Detailed description of what to do', 'optional code snippet');

// Example
solution(
  'Check database connection',
  'Verify that the database is running and accessible',
  'docker ps | grep postgres'
);
```

### `createError()`

Programmatically create error instances:

```typescript
import { createError, ErrorSeverity } from '@zern/kernel';

const error = createError(
  UserNotFoundError,
  { userId: '123' },
  {
    severity: ErrorSeverity.FATAL, // Override default
    solutions: [solution('Custom solution', 'For this specific case')],
  }
);
```

### Error Serialization

```typescript
const error = new DatabaseConnectionError({ host: 'localhost' });

// Convert to JSON
const json = error.toJSON();
console.log(json);
// {
//   name: 'DatabaseConnectionError',
//   code: 'DATABASE_CONNECTION_ERROR',
//   message: '...',
//   severity: 'fatal',
//   context: { host: 'localhost', ... },
//   solutions: [...],
//   timestamp: '2024-01-01T00:00:00.000Z',
//   stack: '...',
//   cause: undefined
// }
```

---

## 🎯 Error Matching

Type-safe pattern matching for errors:

```typescript
import { matchError, ErrorSeverity } from '@zern/kernel';

try {
  await database.connect();
} catch (error) {
  matchError(error)
    .on(DatabaseConnectionError, err => {
      // Type-safe access to err.context
      console.log('DB connection failed:', err.context.host);
      return connectToBackup();
    })
    .on(NetworkError, err => {
      console.log('Network issue');
      return retry();
    })
    .whenSeverity(ErrorSeverity.FATAL, err => {
      console.error('Fatal error:', err.message);
      process.exit(1);
    })
    .otherwise(err => {
      console.error('Unknown error:', err);
      throw err;
    });
}
```

---

## 💡 Best Practices

### 1. Use Specific Error Types

```typescript
// ❌ Don't use generic errors
throw new Error('User not found');

// ✅ Use specific error types
throw new UserNotFoundError(userId);
```

### 2. Provide Context

```typescript
// ❌ No context
throw new DatabaseError();

// ✅ Rich context
throw new DatabaseError({
  operation: 'query',
  table: 'users',
  query: sql,
});
```

### 3. Add Solutions

```typescript
// ❌ No guidance
throw new ConfigError('Invalid config');

// ✅ Actionable solutions
throw new ConfigError({
  solutions: [
    solution('Check config file', 'Verify config.json syntax'),
    solution('Use example config', 'cp config.example.json config.json'),
  ],
});
```

### 4. Set Appropriate Severity

```typescript
// Validation errors
error.severity = ErrorSeverity.ERROR;

// Configuration problems
error.severity = ErrorSeverity.WARN;

// System failures
error.severity = ErrorSeverity.FATAL;
```

### 5. Use onError for Cross-Cutting Concerns

```typescript
const apiPlugin = plugin('api', '1.0.0')
  .setup(() => ({
    // ... API methods
  }))
  .onError((error, ctx) => {
    // ✅ Centralized error handling
    logger.error(`[${ctx.phase}] ${error.message}`);
    metrics.increment('errors', { plugin: ctx.pluginName });

    if (ctx.phase === 'runtime') {
      // Track which methods are failing
      metrics.increment('method_errors', { method: ctx.method });
    }
  });
```

---

## 🔌 Integration with Plugins

### Error Boundaries via Proxy

Create reusable error handling plugins:

```typescript
import { plugin } from '@zern/kernel';

const errorBoundaryPlugin = plugin('error-boundary', '1.0.0')
  .proxy('**', {
    around: async (ctx, next) => {
      try {
        return await next();
      } catch (error) {
        console.error(`Caught error in ${ctx.pluginName}.${ctx.method}`);

        // Return fallback values
        if (ctx.method.startsWith('get')) return null;
        if (ctx.method.startsWith('is')) return false;
        if (ctx.method.startsWith('list')) return [];

        throw error;
      }
    },
  })
  .setup(() => ({}));

// Use globally
const kernel = createKernel()
  .use(errorBoundaryPlugin) // Catches errors from all plugins
  .use(apiPlugin)
  .use(databasePlugin);
```

### Telemetry via Proxy

```typescript
const telemetryPlugin = plugin('telemetry', '1.0.0')
  .proxy('**', {
    onError: async (error, ctx) => {
      const zernError = error instanceof ZernError ? error : null;

      if (zernError) {
        // Add runtime context
        zernError.context.plugin = ctx.pluginName;
        zernError.context.method = ctx.method;

        // Send to monitoring service
        await sendToSentry(zernError);
      }

      throw error;
    },
  })
  .setup(() => ({}));
```

---

## 📦 Example Plugins

Zern provides example plugins demonstrating common error handling patterns:

### 1. Telemetry Plugin

Captures all errors and sends to monitoring services:

```typescript
import { createTelemetryPlugin } from '@zern/kernel/examples';

const kernel = createKernel().use(
  createTelemetryPlugin({
    sentry: { dsn: process.env.SENTRY_DSN },
    datadog: { apiKey: process.env.DD_API_KEY },
    custom: async error => {
      await myCustomErrorTracker.send(error);
    },
  })
);
```

### 2. Retry Plugin

Automatically retries failed operations:

```typescript
import { createRetryPlugin } from '@zern/kernel/examples';

const kernel = createKernel().use(
  createRetryPlugin({
    maxAttempts: 3,
    backoff: 'exponential',
    shouldRetry: error => {
      return error.message.includes('timeout') || error.message.includes('network');
    },
  })
);
```

### 3. Error Boundary Plugin

Provides fallback values for failed operations:

```typescript
import { createErrorBoundaryPlugin } from '@zern/kernel/examples';

const kernel = createKernel().use(
  createErrorBoundaryPlugin({
    fallback: {
      'api.fetchUser': { id: 'unknown', name: 'Guest' },
      'database.query': [],
    },
    defaultFallbacks: true, // Auto-fallbacks for common patterns
  })
);
```

---

## 🔍 Error Severities

```typescript
enum ErrorSeverity {
  INFO = 'info', // Informational messages
  WARN = 'warn', // Warning, but operation continues
  ERROR = 'error', // Error, operation failed
  FATAL = 'fatal', // Critical error, system cannot continue
}
```

### Usage Guide

| Severity | When to Use            | Example                           |
| -------- | ---------------------- | --------------------------------- |
| `INFO`   | Informational messages | Deprecation warnings              |
| `WARN`   | Recoverable issues     | Missing optional config           |
| `ERROR`  | Operation failures     | User not found, validation failed |
| `FATAL`  | System failures        | Database down, out of memory      |

---

## 📚 Summary

Zern's error handling system provides:

✅ **Rich error context** - Automatic capture of file, line, method  
✅ **Actionable solutions** - Guide users to fix issues  
✅ **Global error hooks** - Capture runtime and lifecycle errors  
✅ **Beautiful formatting** - Clear, colored, stack traced output  
✅ **Type-safe matching** - Pattern match on error types  
✅ **Plugin integration** - Build reusable error handling plugins  
✅ **Production ready** - Configurable for dev and prod environments

For complete examples, see:

- `examples/error-handling-demo.ts`
- `examples/plugins/telemetry.plugin.ts`
- `examples/plugins/retry.plugin.ts`
- `examples/plugins/error-boundary.plugin.ts`
