# Utilities

> **Helper functions, validators, and API combinators**

Zern Kernel provides a comprehensive set of utility functions for version management, validation, type guards, and API composition.

---

## 📦 Overview

**Location:** `src/utils/`

**Modules:**

- `version.ts` - Semantic versioning
- `validation.ts` - Input validation
- `guards.ts` - Type guards
- `api-helpers.ts` - API composition utilities

---

## 🔢 Version Management

### `parseVersion(version)`

Parses a semantic version string into components.

```typescript
function parseVersion(version: Version): SemanticVersion;

interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
  readonly build?: string;
}
```

**Example:**

```typescript
import { parseVersion, createVersion } from '@zern/kernel';

const v = createVersion('1.2.3-beta.1+build.123');
const parsed = parseVersion(v);
// {
//   major: 1,
//   minor: 2,
//   patch: 3,
//   prerelease: 'beta.1',
//   build: 'build.123'
// }
```

### `compareVersions(a, b)`

Compares two versions.

```typescript
function compareVersions(a: Version, b: Version): number;
// Returns: -1 if a < b, 0 if a === b, 1 if a > b
```

**Example:**

```typescript
import { compareVersions, createVersion } from '@zern/kernel';

const v1 = createVersion('1.0.0');
const v2 = createVersion('2.0.0');

compareVersions(v1, v2); // -1 (v1 < v2)
compareVersions(v2, v1); // 1  (v2 > v1)
compareVersions(v1, v1); // 0  (v1 === v1)
```

### `satisfiesVersion(version, range)`

Checks if a version satisfies a version range.

```typescript
function satisfiesVersion(version: Version, range: string): boolean;
```

**Supported Ranges:**

- `*` - Any version
- `1.0.0` - Exact version
- `^1.0.0` - Compatible with 1.x.x (major version)
- `~1.2.0` - Compatible with 1.2.x (minor version)

**Example:**

```typescript
import { satisfiesVersion, createVersion } from '@zern/kernel';

const v = createVersion('1.2.3');

satisfiesVersion(v, '*'); // true
satisfiesVersion(v, '1.2.3'); // true
satisfiesVersion(v, '^1.0.0'); // true (same major)
satisfiesVersion(v, '^2.0.0'); // false (different major)
satisfiesVersion(v, '~1.2.0'); // true (same minor)
satisfiesVersion(v, '~1.3.0'); // false (different minor)
```

### `isValidVersionRange(range)`

Validates a version range string.

```typescript
function isValidVersionRange(range: string): boolean;
```

**Example:**

```typescript
import { isValidVersionRange } from '@zern/kernel';

isValidVersionRange('*'); // true
isValidVersionRange('^1.0.0'); // true
isValidVersionRange('~2.1.0'); // true
isValidVersionRange('invalid'); // false
```

---

## ✅ Validation

### `isValidPluginName(name)`

Validates a plugin name.

```typescript
function isValidPluginName(name: string): boolean;
```

**Rules:**

- 2-50 characters
- Must start with a letter
- Can contain letters, numbers, hyphens, underscores

**Example:**

```typescript
import { isValidPluginName } from '@zern/kernel';

isValidPluginName('math'); // true
isValidPluginName('math-plugin'); // true
isValidPluginName('math_plugin'); // true
isValidPluginName('math123'); // true
isValidPluginName('1math'); // false (starts with number)
isValidPluginName('m'); // false (too short)
```

### `validatePluginName(name)`

Validates and throws if invalid.

```typescript
function validatePluginName(name: string): void;
```

**Example:**

```typescript
import { validatePluginName } from '@zern/kernel';

validatePluginName('math'); // OK
validatePluginName('invalid!'); // Throws Error
```

### `isValidKernelId(id)`

Validates a kernel ID.

```typescript
function isValidKernelId(id: string): boolean;
```

**Rules:**

- 5-100 characters
- Can contain letters, numbers, hyphens

**Example:**

```typescript
import { isValidKernelId } from '@zern/kernel';

isValidKernelId('kernel-1'); // true
isValidKernelId('k1'); // false (too short)
```

### Helper Validators

```typescript
function isNonEmptyString(value: unknown): value is string;
function isObject(value: unknown): value is Record<string, unknown>;
function isFunction(value: unknown): value is Function;
```

---

## 🛡️ Type Guards

### Plugin Type Guards

```typescript
function isPluginState(value: unknown): value is PluginState;
function isPluginDependency(value: unknown): value is PluginDependency;
function isPluginExtension(value: unknown): value is PluginExtension;
function isPluginMetadata(value: unknown): value is PluginMetadata;
function isBuiltPlugin(value: unknown): value is BuiltPlugin<string, unknown>;
```

**Example:**

```typescript
import { isPluginMetadata, isBuiltPlugin } from '@zern/kernel';

function processPlugin(value: unknown) {
  if (isBuiltPlugin(value)) {
    // TypeScript knows value is BuiltPlugin
    console.log(value.name, value.version);
  }
}

function processMetadata(value: unknown) {
  if (isPluginMetadata(value)) {
    // TypeScript knows value is PluginMetadata
    console.log(value.state, value.dependencies);
  }
}
```

### Result Type Guards

```typescript
function isResult<T, E>(value: unknown): value is Result<T, E>;
```

**Example:**

```typescript
import { isResult } from '@zern/kernel';

function handleResult(value: unknown) {
  if (isResult(value)) {
    if (value.success) {
      console.log('Success:', value.data);
    } else {
      console.error('Error:', value.error);
    }
  }
}
```

---

## 🔧 API Helpers

Utilities for composing APIs from multiple implementations.

### `bindMethods(instance)`

Binds all methods of an instance to the instance context.

```typescript
function bindMethods<T extends object>(
  instance: T,
  excludeMethods?: readonly string[]
): BoundMethods<T>;
```

**Example:**

```typescript
import { bindMethods } from '@zern/kernel';

class Calculator {
  private value = 0;

  add(x: number) {
    this.value += x;
    return this;
  }

  getValue() {
    return this.value;
  }
}

const calc = new Calculator();
const bound = bindMethods(calc);

// Methods are bound to the instance
const { add, getValue } = bound;
add(10); // Works! (this is bound)
getValue(); // 10
```

### `combineImplementations(...implementations)`

Combines multiple implementation instances into a single API.

```typescript
function combineImplementations<T = Record<string, AnyFunction>>(
  ...implementations: readonly object[]
): T;
```

**Example:**

```typescript
import { combineImplementations } from '@zern/kernel';

class BasicMath {
  add(a: number, b: number) {
    return a + b;
  }
  subtract(a: number, b: number) {
    return a - b;
  }
}

class AdvancedMath {
  multiply(a: number, b: number) {
    return a * b;
  }
  divide(a: number, b: number) {
    return a / b;
  }
}

const basic = new BasicMath();
const advanced = new AdvancedMath();

const mathAPI = combineImplementations(basic, advanced);
// mathAPI has all methods: add, subtract, multiply, divide
```

### `createAPI(implementations, overrides)`

Creates a typed API by combining implementations with optional overrides.

```typescript
function createAPI<T>(implementations: readonly object[], overrides?: Partial<T>): T;
```

**Example:**

```typescript
import { createAPI } from '@zern/kernel';

interface MathAPI {
  add: (a: number, b: number) => number;
  subtract: (a: number, b: number) => number;
  multiply: (a: number, b: number) => number;
}

const basic = new BasicMath();
const advanced = new AdvancedMath();

const mathAPI = createAPI<MathAPI>([basic, advanced], {
  // Override multiply
  multiply: (a, b) => {
    console.log(`Multiplying ${a} * ${b}`);
    return a * b;
  },
});
```

### `createAPIFactory(implementations)`

Creates a factory function for a specific API type.

```typescript
function createAPIFactory<T, TConfig = Record<string, unknown>>(
  implementations: readonly (() => object)[]
): (config?: TConfig) => T;
```

**Example:**

```typescript
import { createAPIFactory } from '@zern/kernel';

const createMathAPI = createAPIFactory<MathAPI>([() => new BasicMath(), () => new AdvancedMath()]);

// Create instances on demand
const math1 = createMathAPI();
const math2 = createMathAPI();
```

### `extendAPI(baseAPI, extensions)`

Helper for creating extension functions that augment existing APIs.

```typescript
function extendAPI<TBase, TExt>(baseAPI: TBase, extensions: TExt): TBase & TExt;
```

**Example:**

```typescript
import { extendAPI } from '@zern/kernel';

const baseAPI = {
  add: (a: number, b: number) => a + b,
};

const extendedAPI = extendAPI(baseAPI, {
  multiply: (a: number, b: number) => a * b,
});

// extendedAPI: { add: ..., multiply: ... }
```

### `pickMethods(instance, methodNames)`

Type-safe method picker - extracts specific methods from an implementation.

```typescript
function pickMethods<T extends object, K extends keyof MethodsOnly<T>>(
  instance: T,
  methodNames: readonly K[]
): Pick<MethodsOnly<T>, K>;
```

**Example:**

```typescript
import { pickMethods } from '@zern/kernel';

class MathImpl {
  add(a: number, b: number) {
    return a + b;
  }
  subtract(a: number, b: number) {
    return a - b;
  }
  multiply(a: number, b: number) {
    return a * b;
  }
  private helper() {
    return 0;
  } // Not included
}

const math = new MathImpl();
const limited = pickMethods(math, ['add', 'subtract']);
// limited: { add: ..., subtract: ... }
```

---

## 🎨 Usage Patterns

### Pattern 1: Class-Based Plugins

```typescript
import { plugin, combineImplementations } from '@zern/kernel';

class BasicMath {
  add(a: number, b: number) {
    return a + b;
  }
  subtract(a: number, b: number) {
    return a - b;
  }
}

class AdvancedMath {
  multiply(a: number, b: number) {
    return a * b;
  }
  divide(a: number, b: number) {
    return a / b;
  }
}

export const mathPlugin = plugin('math', '1.0.0').setup(() => {
  const basic = new BasicMath();
  const advanced = new AdvancedMath();

  return combineImplementations(basic, advanced);
});
```

### Pattern 2: Configurable APIs

```typescript
import { plugin, createAPI } from '@zern/kernel';

interface Config {
  enableAdvanced: boolean;
}

export const mathPlugin = plugin('math', '1.0.0').setup(() => {
  const config: Config = { enableAdvanced: true };

  const implementations = [new BasicMath()];

  if (config.enableAdvanced) {
    implementations.push(new AdvancedMath());
  }

  return createAPI(implementations);
});
```

### Pattern 3: Method Filtering

```typescript
import { plugin, pickMethods } from '@zern/kernel';

class FullMathAPI {
  add(a: number, b: number) {
    return a + b;
  }
  subtract(a: number, b: number) {
    return a - b;
  }
  multiply(a: number, b: number) {
    return a * b;
  }
  divide(a: number, b: number) {
    return a / b;
  }
}

// Expose only safe methods
export const safeMathPlugin = plugin('safe-math', '1.0.0').setup(() => {
  const full = new FullMathAPI();
  return pickMethods(full, ['add', 'subtract']); // No divide (unsafe)
});
```

---

## ✅ Best Practices

### 1. Use Validators Early

✅ **Good:**

```typescript
plugin(name, version).setup(() => {
  validatePluginName(name); // Validate early
  return {
    /* API */
  };
});
```

### 2. Combine Type Guards with Validators

✅ **Good:**

```typescript
function processPlugin(value: unknown) {
  if (!isBuiltPlugin(value)) {
    throw new TypeError('Not a valid plugin');
  }
  // TypeScript knows value is BuiltPlugin
  console.log(value.name);
}
```

### 3. Leverage API Combinators

✅ **Good:**

```typescript
const api = combineImplementations(impl1, impl2, impl3);
```

❌ **Bad:**

```typescript
const api = {
  ...impl1Methods,
  ...impl2Methods,
  ...impl3Methods,
}; // Methods not bound!
```

### 4. Document Version Ranges

✅ **Good:**

```typescript
/**
 * Requires math plugin version ^1.0.0
 * (compatible with 1.x.x, but not 2.x.x)
 */
.depends(mathPlugin, '^1.0.0')
```

---

## 📚 Next Steps

Now that you understand the Utilities, proceed to:

**[API Reference →](./09-api-reference.md)**  
Complete reference documentation for all public APIs.

---

[← Back to Index](./README.md) | [Next: API Reference →](./09-api-reference.md)
