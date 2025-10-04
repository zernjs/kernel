# Architecture Overview

> **Understanding the design principles and structure of Zern Kernel**

This document provides a comprehensive overview of Zern Kernel's architecture, design decisions, and how different components work together.

---

## 🎯 Core Concepts

### What is a Plugin?

A **plugin** is a self-contained unit of functionality that:

- Has a unique name and version
- Exposes an API (set of methods)
- Can depend on other plugins
- Can extend other plugins' APIs
- Can proxy/intercept other plugins' methods

### What is the Kernel?

The **kernel** is the orchestrator that:

- Manages plugin registration and initialization
- Resolves dependencies and initialization order
- Applies extensions and proxies
- Provides type-safe access to plugin APIs

---

## 🏗️ Layered Architecture

Zern Kernel follows a **layered architecture** where each layer has specific responsibilities:

```
  Application Layer
        ↓
  Direct Exports Layer
        ↓
  Extension Layer
        ↓
  Kernel Layer
        ↓
  Plugin Layer
        ↓
  Core Layer
```

### Layer Responsibilities

| Layer              | Responsibility                    | Key Components                                          |
| ------------------ | --------------------------------- | ------------------------------------------------------- |
| **Core**           | Fundamental types, error handling | `Result`, `ZernError`, branded types                    |
| **Plugin**         | Plugin definition and management  | `PluginBuilder`, `PluginRegistry`, `DependencyResolver` |
| **Kernel**         | Orchestration and lifecycle       | `KernelBuilder`, `PluginContainer`, `LifecycleManager`  |
| **Extension**      | Dynamic API modification          | `ExtensionManager`, proxies                             |
| **Direct Exports** | Library-like access               | `createDirectExports`, `createDirectMethod`             |

---

## 🔄 Lifecycle Flow

### 1. Plugin Definition Phase

```typescript
const mathPlugin = plugin('math', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .setup(() => ({
    /* API */
  }));
```

**What happens:**

- Plugin metadata is created (name, version, dependencies)
- Setup function is stored (not executed yet)
- Plugin is "built" but not initialized

### 2. Kernel Building Phase

```typescript
const kernel = await createKernel().use(mathPlugin).use(loggerPlugin).start();
```

**What happens:**

1. Plugins are registered in the container
2. Dependencies are validated
3. Initialization order is calculated (topological sort)
4. Extensions and proxies are registered
5. Plugins are initialized in order
6. APIs are extended and proxied
7. Kernel is ready

### 3. Plugin Initialization

For each plugin (in dependency order):

```
1. Change state to LOADING
2. Resolve dependencies (get already-initialized deps)
3. Execute setup function with context
4. Apply extensions (add new methods)
5. Apply proxies (intercept existing methods)
6. Store final API instance
7. Change state to LOADED
```

### 4. Runtime Phase

```typescript
const math = kernel.get('math');
math.add(2, 3); // Method call
```

**What happens:**

1. Kernel retrieves plugin instance from container
2. Method is called (possibly going through proxies)
3. Result is returned

---

## 🔐 Type Safety

Zern Kernel provides **compile-time type safety** through advanced TypeScript features:

### Plugin Type Inference

```typescript
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
}));

// TypeScript knows the API shape!
type MathAPI = {
  add: (a: number, b: number) => number;
};
```

### Kernel Type Inference

```typescript
const kernel = await createKernel().use(mathPlugin).use(calculatorPlugin).start();

// Kernel knows all plugin APIs!
const math = kernel.get('math'); // Type: MathAPI
const calc = kernel.get('calculator'); // Type: CalculatorAPI
```

### Extension Type Inference

```typescript
const advancedPlugin = plugin('advanced', '1.0.0').extend(mathPlugin, () => ({
  power: (base: number, exp: number) => Math.pow(base, exp),
}));

// Math API now includes power()!
const math = kernel.get('math');
math.power(2, 3); // ✅ Type-safe!
```

---

## 📦 Core Components

### 1. Core Layer (`src/core/`)

**Purpose:** Foundation layer with fundamental types and patterns

**Key Files:**

- `types.ts` - Branded types (`PluginId`, `KernelId`, `Version`)
- `result.ts` - Result pattern for error handling
- `errors.ts` - Error hierarchy

**Design Pattern:** Branded types for compile-time safety

```typescript
type PluginId = string & { readonly __brand: 'PluginId' };
```

### 2. Plugin Layer (`src/plugin/`)

**Purpose:** Plugin definition, registration, and dependency resolution

**Key Files:**

- `plugin.ts` - Plugin builder with fluent API
- `registry.ts` - Plugin storage and metadata
- `resolver.ts` - Dependency resolution (topological sort)

**Design Pattern:** Builder pattern + Registry pattern

```typescript
plugin('math', '1.0.0')
  .depends(logger, '^1.0.0')
  .setup(() => ({
    /* API */
  }));
```

### 3. Kernel Layer (`src/kernel/`)

**Purpose:** Orchestration, initialization, and lifecycle management

**Key Files:**

- `kernel.ts` - Kernel builder and instance
- `container.ts` - Plugin instance storage
- `lifecycle.ts` - Initialization order and state management

**Design Pattern:** Builder pattern + Container pattern

```typescript
createKernel().use(plugin1).use(plugin2).start();
```

### 4. Extension Layer (`src/extension/`)

**Purpose:** Dynamic API modification (extensions + proxies)

**Key Files:**

- `extension.ts` - Extension manager
- `proxy-types.ts` - Proxy type definitions

**Design Pattern:** Decorator pattern + Proxy pattern

```typescript
plugin('logger', '1.0.0')
  .extend(mathPlugin, () => ({
    /* new methods */
  }))
  .proxy(mathPlugin, { before, after, around });
```

### 5. Direct Exports Layer (`src/hooks/`)

**Purpose:** Library-like method access

**Key Files:**

- `direct-exports.ts` - `createDirectExports` implementation
- `direct-methods.ts` - Global kernel management

**Design Pattern:** Proxy pattern + Factory pattern

```typescript
export const { add, multiply } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  multiply: (a: number, b: number): number => 0,
});
```

---

## 🔄 Data Flow

### Plugin Registration Flow

```
User Code
    ↓ (calls plugin())
PluginBuilder
    ↓ (calls .setup())
BuiltPlugin
    ↓ (calls .use())
KernelBuilder
    ↓ (calls .start())
Kernel
```

### Method Call Flow

```
User Code
    ↓ (calls kernel.get())
PluginContainer
    ↓ (returns instance)
ExtensionManager (if extended)
    ↓ (applies proxies if any)
Actual Method
    ↓ (returns result)
User Code
```

### Extension Application Flow

```
  Base API
      ↓
  ExtensionManager
      ↓ (merge extensions)
  Extended API
      ↓ (apply proxies)
  Proxied API
      ↓ (store in container)
  Final API
```

---

## 🎨 Design Patterns

### 1. Builder Pattern

Used for **fluent API construction**:

```typescript
plugin('math', '1.0.0')
  .depends(logger)
  .extend(calculator, () => ({}))
  .proxy(calculator, {})
  .setup(() => ({}));
```

**Benefits:**

- Readable, chainable API
- Progressive type refinement
- Immutable builders

### 2. Result Pattern

Used for **functional error handling**:

```typescript
type Result<T, E> = { success: true; data: T } | { success: false; error: E };
```

**Benefits:**

- Explicit error handling
- No thrown exceptions
- Type-safe error cases

### 3. Dependency Injection

Used for **plugin dependencies**:

```typescript
.setup(({ plugins, kernel }) => {
  const logger = plugins.logger; // Injected!
  return { /* API */ };
});
```

**Benefits:**

- Testable plugins
- Loose coupling
- Clear dependencies

### 4. Proxy Pattern

Used for **method interception**:

```typescript
const proxiedMethod = (...args) => {
  // Before interceptor
  const result = originalMethod(...args);
  // After interceptor
  return result;
};
```

**Benefits:**

- Non-invasive behavior modification
- Cross-cutting concerns (logging, caching)
- Composable proxies

---

## 🔍 Type System Magic

Zern Kernel uses **advanced TypeScript features** for type inference:

### Union to Intersection

```typescript
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void
  ? I
  : never;
```

Converts `A | B` to `A & B` for merging extensions.

### Conditional Types

```typescript
type PluginNameOf<P> = P extends BuiltPlugin<infer N, any, any> ? N : never;
```

Extracts plugin names from plugin types.

### Mapped Types

```typescript
type PluginsMap<U> = {
  [K in PluginNameOf<U>]: ApiForName<U, K> & ExtensionsForName<U, K>;
};
```

Creates a map of plugin names to their final APIs (with extensions).

---

## 📊 State Management

### Plugin States

```typescript
enum PluginState {
  UNLOADED = 'UNLOADED', // Just registered
  LOADING = 'LOADING', // Currently initializing
  LOADED = 'LOADED', // Initialized successfully
  ERROR = 'ERROR', // Initialization failed
}
```

### State Transitions

```
UNLOADED → LOADING → LOADED
             ↓
           ERROR
```

### State Storage

- **PluginRegistry** - Stores plugin state
- **PluginContainer** - Stores plugin instances
- **LifecycleManager** - Manages state transitions

---

## 🚀 Performance Considerations

### Lazy Initialization

Plugins are initialized **on-demand** during `kernel.start()`, not during definition.

### Singleton Instances

Each plugin API is created **once** and reused throughout the application.

### Type Erasure

All TypeScript types are erased at runtime - zero runtime overhead for type safety!

### Caching

- Dependency resolution is calculated once
- Initialization order is cached
- Extension application is done once per plugin

---

## 🔒 Security Considerations

### Isolated Plugins

Plugins only receive **explicit dependencies** - no global access.

### Immutable Configuration

Kernel config is **frozen** after initialization.

### Type Safety

**Compile-time** checks prevent many runtime errors.

---

## 🎯 Design Goals

1. **Type Safety** - Leverage TypeScript to the fullest
2. **Developer Experience** - Intuitive, fluent APIs
3. **Flexibility** - Support various plugin patterns
4. **Performance** - Minimize runtime overhead
5. **Extensibility** - Allow plugins to extend each other
6. **Predictability** - Clear lifecycle and execution order

---

## 📚 Next Steps

Now that you understand the architecture, proceed to:

**[Core Layer →](./02-core-layer.md)**  
Learn about the fundamental types and patterns that power Zern Kernel.

---

[← Back to Index](./README.md) | [Next: Core Layer →](./02-core-layer.md)
