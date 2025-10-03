# Best Practices

> **Patterns, guidelines, and recommendations for Zern Kernel**

This document provides recommended patterns, common pitfalls to avoid, and best practices for using Zern Kernel effectively.

---

## 🎯 Plugin Design

### 1. Single Responsibility Principle

✅ **Good:** Each plugin has a single, well-defined purpose

```typescript
// ✅ Focused plugin
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b,
}));

// ✅ Another focused plugin
const loggerPlugin = plugin('logger', '1.0.0').setup(() => ({
  log: msg => console.log(msg),
  error: msg => console.error(msg),
}));
```

❌ **Bad:** Plugin does too many unrelated things

```typescript
// ❌ Too broad
const everythingPlugin = plugin('everything', '1.0.0').setup(() => ({
  // Math
  add: (a, b) => a + b,
  // Logging
  log: msg => console.log(msg),
  // HTTP
  fetch: url => fetch(url),
  // File I/O
  readFile: path => fs.readFileSync(path),
}));
```

### 2. Explicit Dependencies

✅ **Good:** Declare all dependencies

```typescript
const calculatorPlugin = plugin('calculator', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .setup(({ plugins }) => {
    const { math, logger } = plugins;
    return {
      calculate: expr => {
        logger.log(`Calculating: ${expr}`);
        return math.add(1, 2);
      },
    };
  });
```

❌ **Bad:** Rely on global state or undeclared dependencies

```typescript
const calculatorPlugin = plugin('calculator', '1.0.0').setup(({ kernel }) => ({
  calculate: expr => {
    // ❌ Not declared as dependency!
    const math = kernel.get('math');
    return math.add(1, 2);
  },
}));
```

### 3. Immutable APIs

✅ **Good:** Return new objects, don't mutate

```typescript
const counterPlugin = plugin('counter', '1.0.0').setup(() => {
  let count = 0;

  return {
    increment: () => ++count,
    decrement: () => --count,
    getValue: () => count, // ✅ Returns value, doesn't expose internal state
  };
});
```

❌ **Bad:** Expose mutable state

```typescript
const counterPlugin = plugin('counter', '1.0.0').setup(() => {
  const state = { count: 0 }; // ❌ Mutable object

  return {
    getState: () => state, // ❌ Direct access to mutable state!
    increment: () => state.count++,
  };
});

// Later:
const counter = kernel.get('counter');
counter.getState().count = 999; // ❌ Can mutate from outside!
```

### 4. Type Your APIs

✅ **Good:** Define explicit interfaces

```typescript
interface MathAPI {
  add: (a: number, b: number) => number;
  subtract: (a: number, b: number) => number;
  multiply: (a: number, b: number) => number;
  divide: (a: number, b: number) => number;
}

const mathPlugin = plugin('math', '1.0.0').setup(
  (): MathAPI => ({
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    multiply: (a, b) => a * b,
    divide: (a, b) => {
      if (b === 0) throw new Error('Division by zero');
      return a / b;
    },
  })
);
```

❌ **Bad:** Use implicit any types

```typescript
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: any, b: any) => a + b, // ❌ any types
  subtract: (a: any, b: any) => a - b,
}));
```

---

## 🏗️ Kernel Management

### 1. Always Export the Kernel

✅ **Good:** Export for reuse

```typescript
// main.ts
export const kernel = await createKernel().use(mathPlugin).use(calculatorPlugin).start();

// other-file.ts
import { kernel } from './main';
const math = kernel.get('math'); // ✅ Type-safe!
```

❌ **Bad:** Don't export, lose type safety

```typescript
// main.ts
const kernel = await createKernel().use(mathPlugin).start();
// ❌ Not exported!

// other-file.ts
// Can't access kernel 😢
```

### 2. Initialize Once

✅ **Good:** Single initialization point

```typescript
// main.ts - Single entry point
export const kernel = await createKernel().use(mathPlugin).use(calculatorPlugin).start();

// Import in other files
import { kernel } from './main';
```

❌ **Bad:** Multiple initializations

```typescript
// ❌ file1.ts
const kernel1 = await createKernel().use(mathPlugin).start();

// ❌ file2.ts
const kernel2 = await createKernel().use(mathPlugin).start();

// Now you have 2 separate kernels!
```

### 3. Handle Initialization Errors

✅ **Good:** Catch and handle errors

```typescript
try {
  const kernel = await createKernel().use(mathPlugin).start();
} catch (error) {
  if (error instanceof KernelInitializationError) {
    console.error('Kernel failed to initialize:', error.cause);
    process.exit(1);
  }
  throw error;
}
```

❌ **Bad:** Ignore errors

```typescript
// ❌ Might throw, but not handled
const kernel = await createKernel().use(mathPlugin).start();
```

### 4. Graceful Shutdown

✅ **Good:** Clean up resources

```typescript
const kernel = await createKernel().use(mathPlugin).start();

// Cleanup on exit
process.on('SIGINT', async () => {
  await kernel.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await kernel.shutdown();
  process.exit(0);
});
```

❌ **Bad:** Abrupt termination

```typescript
process.on('SIGINT', () => {
  process.exit(0); // ❌ No cleanup!
});
```

---

## 🔧 Extension Patterns

### 1. Extend, Don't Modify

✅ **Good:** Use `.extend()` to add functionality

```typescript
const advancedMathPlugin = plugin('advanced-math', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .extend(mathPlugin, () => ({
    power: (base, exp) => Math.pow(base, exp),
    sqrt: x => Math.sqrt(x),
  }))
  .setup(() => ({}));
```

❌ **Bad:** Try to monkey-patch

```typescript
const advancedMathPlugin = plugin('advanced-math', '1.0.0').setup(({ kernel }) => {
  const math = kernel.get('math');
  // ❌ Don't modify original API!
  (math as any).power = (base, exp) => Math.pow(base, exp);
  return {};
});
```

### 2. Use Proxies for Cross-Cutting Concerns

✅ **Good:** Logging, timing, caching via proxies

```typescript
const loggingPlugin = plugin('logging', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .proxy(mathPlugin, {
    methods: ['add', 'multiply'],
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

❌ **Bad:** Put logging inside business logic

```typescript
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a, b) => {
    console.log(`Adding ${a} + ${b}`); // ❌ Mixed concerns
    return a + b;
  },
}));
```

### 3. Keep Proxies Simple

✅ **Good:** Focused, simple proxies

```typescript
.proxy(mathPlugin, {
  methods: 'add',
  before: ctx => {
    console.log(`Called ${ctx.method}`);
  },
})
```

❌ **Bad:** Complex, multi-purpose proxies

```typescript
.proxy(mathPlugin, {
  methods: 'add',
  before: async ctx => {
    // ❌ Too much happening here
    await validateWithAPI(ctx.args);
    await logToDatabase(ctx);
    await checkPermissions(ctx.userId);
    await sendNotification(ctx);
    await updateAnalytics(ctx);
  },
})
```

---

## 📦 Direct Exports

### 1. Match Plugin API Exactly

✅ **Good:** Types match perfectly

```typescript
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
}));

export const { add } = createDirectExports('math', {
  add: (a: number, b: number): number => 0, // ✅ Matches
});
```

❌ **Bad:** Type mismatch

```typescript
export const { add } = createDirectExports('math', {
  add: (a: string, b: string): string => '', // ❌ Wrong types!
});
```

### 2. Document Direct Exports

✅ **Good:** Clear documentation

```typescript
/**
 * Direct exports for the math plugin.
 *
 * These methods require the kernel to be initialized.
 *
 * @example
 * await createKernel().use(mathPlugin).start();
 * const result = add(2, 3); // 5
 */
export const { add, multiply } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  multiply: (a: number, b: number): number => 0,
});
```

### 3. Initialize Kernel Before Using Direct Exports

✅ **Good:** Proper initialization order

```typescript
// main.ts
export const kernel = await createKernel().use(mathPlugin).start();

// other-file.ts
import { add } from './math-plugin';
const result = add(2, 3); // ✅ Works!
```

❌ **Bad:** Use before initialization

```typescript
import { add } from './math-plugin';
const result = add(2, 3); // ❌ Error: Kernel not initialized!

// Later...
await createKernel().use(mathPlugin).start();
```

---

## 🔐 Version Management

### 1. Use Semantic Versioning

✅ **Good:** Follow semver

```typescript
plugin('math', '1.0.0'); // Initial release
plugin('math', '1.1.0'); // New features (backwards compatible)
plugin('math', '2.0.0'); // Breaking changes
```

### 2. Use Version Ranges Wisely

✅ **Good:** Appropriate ranges

```typescript
.depends(mathPlugin, '^1.0.0')  // ✅ Allow patch & minor updates
.depends(corePlugin, '~2.1.0')  // ✅ Allow only patch updates
.depends(utilsPlugin, '*')      // ✅ Any version (for utilities)
```

❌ **Bad:** Too restrictive or too loose

```typescript
.depends(mathPlugin, '1.0.0')   // ❌ Too restrictive
.depends(corePlugin, '*')       // ❌ Too loose for core dependency
```

### 3. Document Breaking Changes

✅ **Good:** Clear changelog

```typescript
/**
 * Math Plugin v2.0.0
 *
 * BREAKING CHANGES:
 * - divide() now throws on division by zero (was returning Infinity)
 * - Removed deprecated sqrt() method (use Math.sqrt instead)
 *
 * NEW FEATURES:
 * - Added power() method
 */
plugin('math', '2.0.0').setup(() => ({
  /* ... */
}));
```

---

## ⚠️ Common Pitfalls

### 1. Circular Dependencies

❌ **Bad:**

```typescript
const pluginA = plugin('a', '1.0.0')
  .depends(pluginB, '*')
  .setup(() => ({}));

const pluginB = plugin('b', '1.0.0')
  .depends(pluginA, '*')
  .setup(() => ({}));

// ❌ Circular dependency error!
```

✅ **Fix:** Restructure dependencies

```typescript
// Create a shared plugin
const sharedPlugin = plugin('shared', '1.0.0').setup(() => ({}));

const pluginA = plugin('a', '1.0.0')
  .depends(sharedPlugin, '*')
  .setup(() => ({}));

const pluginB = plugin('b', '1.0.0')
  .depends(sharedPlugin, '*')
  .setup(() => ({}));
```

### 2. Side Effects in Setup

❌ **Bad:** Side effects during setup

```typescript
const pluginA = plugin('a', '1.0.0').setup(() => {
  // ❌ Side effects!
  window.myGlobal = 'something';
  startBackgroundTask();
  subscribeToEvents();

  return {
    /* API */
  };
});
```

✅ **Fix:** Keep setup pure, use lifecycle hooks

```typescript
const pluginA = plugin('a', '1.0.0').setup(() => ({
  initialize: () => {
    // ✅ Explicit initialization
    window.myGlobal = 'something';
  },
  start: () => {
    // ✅ Explicit start
    startBackgroundTask();
  },
}));
```

### 3. Mutable State Leaks

❌ **Bad:**

```typescript
const configPlugin = plugin('config', '1.0.0').setup(() => {
  const config = { apiKey: 'secret' };

  return {
    getConfig: () => config, // ❌ Direct reference!
  };
});

// Later:
const config = kernel.get('config');
const c = config.getConfig();
c.apiKey = 'hacked'; // ❌ Mutated!
```

✅ **Fix:** Return copies

```typescript
const configPlugin = plugin('config', '1.0.0').setup(() => {
  const config = { apiKey: 'secret' };

  return {
    getConfig: () => ({ ...config }), // ✅ Copy
  };
});
```

### 4. Type Assertions

❌ **Bad:**

```typescript
const math = kernel.get('math') as any; // ❌ Lost type safety
math.invalidMethod(); // No error!
```

✅ **Fix:** Let TypeScript infer

```typescript
const math = kernel.get('math'); // ✅ Automatic inference
// math.invalidMethod(); // ❌ Compile error
```

---

## 📐 Architecture Patterns

### Pattern 1: Layered Plugins

```typescript
// Layer 1: Core utilities
const corePlugin = plugin('core', '1.0.0').setup(() => ({
  hash: (str) => /* ... */,
  encode: (str) => /* ... */,
}));

// Layer 2: Business logic
const authPlugin = plugin('auth', '1.0.0')
  .depends(corePlugin, '^1.0.0')
  .setup(({ plugins }) => ({
    login: (user, pass) => {
      const hashed = plugins.core.hash(pass);
      // ...
    },
  }));

// Layer 3: API layer
const apiPlugin = plugin('api', '1.0.0')
  .depends(authPlugin, '^1.0.0')
  .setup(({ plugins }) => ({
    handleLogin: (req) => {
      return plugins.auth.login(req.user, req.password);
    },
  }));
```

### Pattern 2: Feature Modules

```typescript
// Feature: Authentication
const authPlugins = [authCorePlugin, authSessionPlugin, authJWTPlugin];

// Feature: Payments
const paymentPlugins = [paymentCorePlugin, paymentStripePlugin, paymentPayPalPlugin];

// Compose
const kernel = await createKernel()
  .use(...authPlugins)
  .use(...paymentPlugins)
  .start();
```

### Pattern 3: Plugin Families

```typescript
// Base plugin
const baseLoggerPlugin = plugin('logger-base', '1.0.0').setup(() => ({
  log: msg => console.log(msg),
}));

// Console logger
const consoleLoggerPlugin = plugin('logger-console', '1.0.0')
  .depends(baseLoggerPlugin, '^1.0.0')
  .extend(baseLoggerPlugin, () => ({
    debug: msg => console.debug(msg),
  }))
  .setup(() => ({}));

// File logger
const fileLoggerPlugin = plugin('logger-file', '1.0.0')
  .depends(baseLoggerPlugin, '^1.0.0')
  .extend(baseLoggerPlugin, () => ({
    logToFile: msg => fs.appendFileSync('log.txt', msg),
  }))
  .setup(() => ({}));
```

---

## 📚 Summary

### Do's ✅

- Define single-purpose plugins
- Declare all dependencies
- Export the kernel
- Use semantic versioning
- Type your APIs
- Keep setup functions pure
- Use wrappers for cross-cutting concerns
- Handle errors properly
- Document your plugins

### Don'ts ❌

- Don't create circular dependencies
- Don't use side effects in setup
- Don't expose mutable state
- Don't use `any` types
- Don't bypass dependency declarations
- Don't initialize multiple kernels
- Don't ignore initialization errors
- Don't forget to shutdown gracefully

---

## 🎓 Final Thoughts

Zern Kernel is designed to be:

- **Type-safe** - Leverage TypeScript to the fullest
- **Flexible** - Support various plugin patterns
- **Predictable** - Clear lifecycle and execution order
- **Extensible** - Plugins can extend each other
- **Performant** - Minimal runtime overhead

Follow these best practices to build robust, maintainable, and type-safe plugin-based applications!

---

[← Back to Index](./README.md)
