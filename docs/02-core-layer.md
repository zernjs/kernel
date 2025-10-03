# Core Layer

> **Fundamental types, error handling, and the Result pattern**

The Core Layer provides the foundation for Zern Kernel. It defines fundamental types, error classes, and the Result pattern for functional error handling.

---

## 📦 Overview

**Location:** `src/core/`

**Key Files:**

- `types.ts` - Branded types and core interfaces
- `result.ts` - Result pattern implementation
- `errors.ts` - Error hierarchy

**Purpose:**

- Provide type-safe primitives
- Enable functional error handling
- Define plugin metadata structures

---

## 🏷️ Branded Types

### What are Branded Types?

**Branded types** add compile-time safety to primitive types, preventing accidental misuse.

```typescript
type PluginId = string & { readonly __brand: 'PluginId' };
type KernelId = string & { readonly __brand: 'KernelId' };
type Version = string & { readonly __brand: 'Version' };
```

### Why Use Branded Types?

❌ **Without branding:**

```typescript
function registerPlugin(id: string) {
  /* ... */
}
function initKernel(id: string) {
  /* ... */
}

const pluginId = 'math';
const kernelId = 'kernel-1';

registerPlugin(kernelId); // ⚠️ Oops! Wrong ID type, but compiles
```

✅ **With branding:**

```typescript
function registerPlugin(id: PluginId) {
  /* ... */
}
function initKernel(id: KernelId) {
  /* ... */
}

const pluginId = createPluginId('math');
const kernelId = createKernelId('kernel-1');

registerPlugin(kernelId); // ❌ Compile error! Type mismatch
```

### Creating Branded Values

```typescript
// Factory functions enforce validation
export function createPluginId(value: string): PluginId {
  return value as PluginId;
}

export function createKernelId(value: string): KernelId {
  return value as KernelId;
}

export function createVersion(value: string): Version {
  if (!isValidVersion(value)) {
    throw new Error(`Invalid version: ${value}`);
  }
  return value as Version;
}
```

---

## 🎯 Result Pattern

### What is the Result Pattern?

The **Result pattern** is a functional approach to error handling that makes errors **explicit** in the type system.

```typescript
type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };
```

### Why Use Result?

❌ **Traditional exceptions:**

```typescript
function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

// Caller doesn't know this can throw!
const result = divide(10, 0); // 💥 Runtime error
```

✅ **Result pattern:**

```typescript
function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) {
    return failure(new Error('Division by zero'));
  }
  return success(a / b);
}

// Caller MUST handle both cases!
const result = divide(10, 0);
if (result.success) {
  console.log(result.data); // Safe to access
} else {
  console.error(result.error); // Error handling
}
```

### Creating Results

```typescript
// Success case
export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

// Failure case
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}
```

### Type Guards

```typescript
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}
```

### Result Utilities

#### mapResult - Transform success data

```typescript
export function mapResult<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  if (!result.success) return result;
  return success(fn(result.data));
}

// Usage
const numResult = success(10);
const strResult = mapResult(numResult, n => n.toString()); // Result<string>
```

#### chainResult - Sequencing operations

```typescript
export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (!result.success) return result;
  return fn(result.data);
}

// Usage
const result = success(10);
const chained = chainResult(result, n => divide(n, 2)); // Result<number>
```

#### collectResults - Gather multiple results

```typescript
export function collectResults<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const data: T[] = [];
  for (const result of results) {
    if (!result.success) return result; // First error stops
    data.push(result.data);
  }
  return success(data);
}

// Usage
const results = [success(1), success(2), success(3)];
const collected = collectResults(results); // Result<number[]>
```

---

## ⚠️ Error Hierarchy

Zern Kernel uses a **hierarchical error system** for clear error categorization.

### Base Error Class

```typescript
export abstract class ZernError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

**Features:**

- `code` property for programmatic error checking
- `cause` property for error chaining
- Automatic `name` from class name

### Error Categories

#### Plugin Errors

```typescript
export class PluginError extends ZernError {
  readonly code: string = 'PLUGIN_ERROR';
}

export class PluginNotFoundError extends PluginError {
  readonly code = 'PLUGIN_NOT_FOUND';
  constructor(pluginId: string) {
    super(`Plugin not found: ${pluginId}`);
  }
}

export class PluginLoadError extends PluginError {
  readonly code = 'PLUGIN_LOAD_ERROR';
  constructor(pluginId: string, cause?: Error) {
    super(`Failed to load plugin ${pluginId}`, cause);
  }
}

export class PluginDependencyError extends PluginError {
  readonly code = 'PLUGIN_DEPENDENCY_ERROR';
  constructor(pluginId: string, dependencyId: string) {
    super(`Dependency error in plugin ${pluginId}: missing ${dependencyId}`);
  }
}
```

#### Kernel Errors

```typescript
export class KernelError extends ZernError {
  readonly code: string = 'KERNEL_ERROR';
}

export class KernelInitializationError extends KernelError {
  readonly code = 'KERNEL_INITIALIZATION_ERROR';
  constructor(cause?: Error) {
    super('Failed to initialize kernel', cause);
  }
}

export class CircularDependencyError extends KernelError {
  readonly code = 'CIRCULAR_DEPENDENCY_ERROR';
  constructor(cycle: readonly string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
  }
}
```

#### Version Errors

```typescript
export class VersionError extends ZernError {
  readonly code: string = 'VERSION_ERROR';
}

export class VersionMismatchError extends VersionError {
  readonly code = 'VERSION_MISMATCH_ERROR';
  constructor(pluginId: string, required: string, actual: string) {
    super(`Version mismatch for ${pluginId}: required ${required}, got ${actual}`);
  }
}
```

### Error Handling Examples

```typescript
// Catching specific errors
try {
  const plugin = kernel.get('unknown');
} catch (error) {
  if (error instanceof PluginNotFoundError) {
    console.log(`Plugin missing: ${error.code}`);
  } else if (error instanceof KernelInitializationError) {
    console.log(`Kernel failed: ${error.cause}`);
  }
}

// Checking error codes
if (error.code === 'PLUGIN_NOT_FOUND') {
  // Handle missing plugin
}
```

---

## 📋 Core Types

### KernelContext

Context available to plugins during setup:

```typescript
export interface KernelContext {
  readonly id: KernelId;
  readonly config: KernelConfig;
  readonly get: <T>(pluginId: string) => T;
}
```

**Usage:**

```typescript
plugin('math', '1.0.0').setup(({ kernel }) => {
  // Access kernel context
  console.log(`Initializing in kernel: ${kernel.id}`);
  const logger = kernel.get<LoggerAPI>('logger');

  return {
    /* API */
  };
});
```

### KernelConfig

Configuration options for the kernel:

```typescript
export interface KernelConfig {
  readonly autoGlobal?: boolean; // Auto-register global kernel
  readonly strictVersioning?: boolean; // Enforce strict version matching
  readonly circularDependencies?: boolean; // Allow circular deps (dangerous!)
  readonly initializationTimeout?: number; // Max init time in ms
  readonly extensionsEnabled?: boolean; // Enable/disable extensions
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

**Defaults:**

```typescript
{
  autoGlobal: true,
  strictVersioning: true,
  circularDependencies: false,
  initializationTimeout: 30000,
  extensionsEnabled: true,
  logLevel: 'info',
}
```

### PluginState

```typescript
export enum PluginState {
  UNLOADED = 'UNLOADED', // Registered but not initialized
  LOADING = 'LOADING', // Currently initializing
  LOADED = 'LOADED', // Successfully initialized
  ERROR = 'ERROR', // Initialization failed
}
```

### PluginMetadata

Complete information about a plugin:

```typescript
export interface PluginMetadata {
  readonly id: PluginId;
  readonly name: string;
  readonly version: Version;
  readonly state: PluginState;
  readonly dependencies: readonly PluginDependency[];
  readonly extensions: readonly PluginExtension[];
  readonly wrappers: readonly MethodWrapper[];
}
```

### PluginDependency

```typescript
export interface PluginDependency {
  readonly pluginId: PluginId;
  readonly versionRange: string; // e.g., "^1.0.0", "~2.1.0"
}
```

### PluginExtension

```typescript
export interface PluginExtension {
  readonly targetPluginId: PluginId;
  readonly extensionFn: (api: unknown) => unknown;
}
```

---

## ✅ Best Practices

### 1. Always Use Factory Functions

✅ **Good:**

```typescript
const pluginId = createPluginId('math');
const version = createVersion('1.0.0');
```

❌ **Bad:**

```typescript
const pluginId = 'math' as PluginId; // Bypass validation
const version = '1.0.0' as Version; // No validation
```

### 2. Handle Result Types Explicitly

✅ **Good:**

```typescript
const result = registry.get(pluginId);
if (result.success) {
  usePlugin(result.data);
} else {
  handleError(result.error);
}
```

❌ **Bad:**

```typescript
const result = registry.get(pluginId);
const plugin = result.data; // Might not exist!
```

### 3. Use Specific Error Types

✅ **Good:**

```typescript
if (error instanceof PluginNotFoundError) {
  // Specific handling
}
```

❌ **Bad:**

```typescript
if (error.message.includes('not found')) {
  // Fragile string matching
}
```

### 4. Leverage Result Utilities

✅ **Good:**

```typescript
const result = chainResult(fetchPlugin('math'), plugin => validatePlugin(plugin));
```

❌ **Bad:**

```typescript
const result1 = fetchPlugin('math');
if (!result1.success) return result1;
const result2 = validatePlugin(result1.data);
if (!result2.success) return result2;
// Repetitive!
```

---

## 🔍 Deep Dive: Type Safety

### Branded Types Implementation

```typescript
// Runtime: just a string
const id: PluginId = createPluginId('math');
console.log(typeof id); // "string"

// Compile-time: distinct type
function needsPluginId(id: PluginId) {}
function needsKernelId(id: KernelId) {}

needsPluginId(id); // ✅ OK
needsKernelId(id); // ❌ Compile error
```

### Result Pattern Type Narrowing

```typescript
declare function op(): Result<number, Error>;

const result = op();

// TypeScript doesn't know which case yet
result.data; // ❌ Error: Property 'data' might not exist
result.error; // ❌ Error: Property 'error' might not exist

// After type guard
if (result.success) {
  result.data; // ✅ OK: TypeScript knows it's the success case
  result.error; // ❌ Error: Property 'error' doesn't exist here
} else {
  result.data; // ❌ Error: Property 'data' doesn't exist here
  result.error; // ✅ OK: TypeScript knows it's the failure case
}
```

---

## 📚 Next Steps

Now that you understand the Core Layer, proceed to:

**[Plugin System →](./03-plugin-system.md)**  
Learn how to define, build, and manage plugins.

---

[← Back to Index](./README.md) | [Next: Plugin System →](./03-plugin-system.md)
