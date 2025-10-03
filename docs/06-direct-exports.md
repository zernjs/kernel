# Direct Exports

> **Library-like direct method imports with full type safety**

Direct Exports allow you to import plugin methods directly, like a regular library, while maintaining full type safety and runtime resolution through the kernel.

---

## 📦 Overview

**Location:** `src/hooks/`

**Key Functions:**

- `createDirectExports` - Export multiple methods from a plugin
- `createDirectMethod` - Export a single method
- `setGlobalKernel` / `getGlobalKernel` - Global kernel management

**Benefits:**

- ✅ Import methods like a regular library
- ✅ Full type safety and autocomplete
- ✅ Automatic kernel resolution at runtime
- ✅ Works with extended methods

---

## 🚀 Quick Start

### 1. Define Your Plugin

```typescript
// math-plugin.ts
import { plugin } from '@zern/kernel';

export const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b,
  multiply: (a: number, b: number) => a * b,
}));
```

### 2. Create Direct Exports

```typescript
// math-plugin.ts (continued)
import { createDirectExports } from '@zern/kernel';

export const { add, subtract, multiply } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  subtract: (a: number, b: number): number => 0,
  multiply: (a: number, b: number): number => 0,
});
```

💡 **Note:** The implementation values (`=> 0`) are just **type hints** - they're not used at runtime!

### 3. Initialize Kernel

```typescript
// main.ts
import { createKernel } from '@zern/kernel';
import { mathPlugin } from './math-plugin';

export const kernel = await createKernel().use(mathPlugin).start();
```

### 4. Use Direct Imports

```typescript
// anywhere.ts
import { add, multiply } from './math-plugin';

console.log(add(2, 3)); // ✅ 5 - Full type safety!
console.log(multiply(4, 5)); // ✅ 20 - Autocomplete works!
```

---

## 🔧 API Reference

### `createDirectExports(pluginName, methodSignatures)`

Creates multiple direct method exports with automatic type inference.

**Signature:**

```typescript
function createDirectExports<
  TPluginName extends string,
  TMethods extends Record<string, (...args: any[]) => any>,
>(pluginName: TPluginName, methodSignatures: TMethods): TMethods;
```

**Parameters:**

- `pluginName` - The plugin name (must match the plugin ID)
- `methodSignatures` - Object with method signatures (values are ignored, only types matter)

**Returns:**

- Object with the same keys, but values are runtime wrappers

**Example:**

```typescript
export const { log, exp, sqrt } = createDirectExports('scientific', {
  log: (x: number): number => 0,
  exp: (x: number): number => 0,
  sqrt: (x: number): number => 0,
});
```

### `createDirectMethod(pluginName, methodName)`

Creates a single direct method export.

**Signature:**

```typescript
function createDirectMethod<TPluginName extends string, TMethodName extends string>(
  pluginName: TPluginName,
  methodName: TMethodName
): (...args: any[]) => any;
```

**Example:**

```typescript
export const add = createDirectMethod('math', 'add');
export const multiply = createDirectMethod('math', 'multiply');
```

💡 **Note:** `createDirectExports` is usually preferred as it provides better type inference.

---

## 🎯 Advanced Usage

### Exporting Extended Methods

When one plugin extends another, you can export the extended methods:

```typescript
// math-plugin.ts
export const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
}));

// scientific-plugin.ts
import { mathPlugin } from './math-plugin';

export const scientificPlugin = plugin('scientific', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .extend(mathPlugin, () => ({
    log: (x: number) => Math.log(x),
    exp: (x: number) => Math.exp(x),
  }))
  .setup(() => ({
    calculatePi: () => Math.PI,
  }));

// Export extended methods (they'll be on math plugin at runtime!)
export const { log, exp } = createDirectExports('math', {
  log: (x: number): number => 0,
  exp: (x: number): number => 0,
});

// Export own methods
export const { calculatePi } = createDirectExports('scientific', {
  calculatePi: (): number => 0,
});
```

**Usage:**

```typescript
import { log, exp } from './scientific-plugin';

console.log(log(Math.E)); // ✅ Works! (extended method on math plugin)
console.log(exp(1)); // ✅ Works! (extended method on math plugin)
```

### Type-Safe Method Signatures

Define an interface for your API to ensure consistency:

```typescript
// Define API interface
interface MathAPI {
  add: (a: number, b: number) => number;
  subtract: (a: number, b: number) => number;
  multiply: (a: number, b: number) => number;
}

// Plugin implementation
export const mathPlugin = plugin('math', '1.0.0').setup(
  (): MathAPI => ({
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    multiply: (a, b) => a * b,
  })
);

// Direct exports with interface
export const { add, subtract, multiply } = createDirectExports<'math', MathAPI>('math', {
  add: (a: number, b: number): number => 0,
  subtract: (a: number, b: number): number => 0,
  multiply: (a: number, b: number): number => 0,
});
```

### Conditional Exports

Export different methods based on configuration:

```typescript
const config = { includeAdvanced: true };

const basicExports = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  subtract: (a: number, b: number): number => 0,
});

const advancedExports = config.includeAdvanced
  ? createDirectExports('math', {
      power: (base: number, exp: number): number => 0,
      sqrt: (x: number): number => 0,
    })
  : {};

export const { add, subtract } = basicExports;
export const { power, sqrt } = advancedExports;
```

---

## 🔍 How It Works

### At Compile Time

```typescript
export const { add } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  //                                      ^
  //                                      Type hint only!
});
```

TypeScript sees:

- `add` has type `(a: number, b: number) => number`
- Provides autocomplete and type checking

### At Runtime

```typescript
// When you call add(2, 3):
1. createDirectExports created a wrapper function
2. Wrapper calls getGlobalKernel()
3. Gets the 'math' plugin from kernel
4. Calls the actual add method on the plugin
5. Returns the result
```

**Flow:**

```
add(2, 3)
   ↓
Wrapper Function
   ↓
getGlobalKernel()
   ↓
kernel.get('math')
   ↓
mathPlugin.add(2, 3)
   ↓
Result: 5
```

---

## ⚠️ Important Notes

### Kernel Must Be Initialized

Direct methods **require the kernel to be initialized** before use:

```typescript
// ❌ Won't work - kernel not initialized yet
import { add } from './math-plugin';
console.log(add(2, 3)); // 💥 Error: Kernel not initialized

// ✅ Works - kernel initialized first
import { createKernel } from '@zern/kernel';
import { mathPlugin } from './math-plugin';
import { add } from './math-plugin';

await createKernel().use(mathPlugin).start();
console.log(add(2, 3)); // ✅ 5
```

### Initialization Order

```typescript
// main.ts - Initialize kernel first
export const kernel = await createKernel().use(mathPlugin).start();

// other-file.ts - Import after initialization
import { add } from './math-plugin';
const result = add(2, 3); // ✅ Works
```

### Top-Level Await

If you get an error about top-level await:

**Option 1:** Use TypeScript config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022"
  }
}
```

**Option 2:** Use an async IIFE:

```typescript
(async () => {
  await createKernel().use(mathPlugin).start();

  const result = add(2, 3);
  console.log(result);
})();
```

---

## 🎨 Patterns

### Pattern 1: Separate Files

```
my-plugin/
  ├── plugin.ts         # Plugin definition
  ├── direct-api.ts     # Direct exports
  └── index.ts          # Re-export everything
```

**plugin.ts:**

```typescript
export const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a, b) => a + b,
}));
```

**direct-api.ts:**

```typescript
import { createDirectExports } from '@zern/kernel';

export const { add } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
});
```

**index.ts:**

```typescript
export { mathPlugin } from './plugin';
export { add } from './direct-api';
```

### Pattern 2: Single File

```typescript
// math-plugin.ts
export const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a, b) => a + b,
}));

export const { add } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
});
```

### Pattern 3: Namespace Exports

```typescript
// math-plugin.ts
export const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
}));

// Export as namespace
export const Math = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  subtract: (a: number, b: number): number => 0,
});

// Usage:
import { Math } from './math-plugin';
Math.add(2, 3);
```

---

## ✅ Best Practices

### 1. Always Provide Type Hints

✅ **Good:**

```typescript
export const { add } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  //    ↑ Type hint          ↑ Return type
});
```

❌ **Bad:**

```typescript
export const { add } = createDirectExports('math', {
  add: (...args: any[]): any => 0, // Lost type safety!
});
```

### 2. Match Plugin API Exactly

✅ **Good:**

```typescript
// Plugin
export const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
}));

// Direct exports (matches exactly)
export const { add } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
});
```

❌ **Bad:**

```typescript
// Direct exports (doesn't match)
export const { add } = createDirectExports('math', {
  add: (a: string, b: string): string => '', // ❌ Wrong types!
});
```

### 3. Document Direct Exports

✅ **Good:**

```typescript
/**
 * Direct method exports for the math plugin.
 * These methods require the kernel to be initialized.
 *
 * @example
 * await createKernel().use(mathPlugin).start();
 * add(2, 3); // 5
 */
export const { add, subtract } = createDirectExports('math', {
  add: (a: number, b: number): number => 0,
  subtract: (a: number, b: number): number => 0,
});
```

### 4. Keep Exports Organized

✅ **Good:**

```typescript
// Group related exports
export const { add, subtract, multiply, divide } = createDirectExports('math', {
  // Arithmetic
  add: (a: number, b: number): number => 0,
  subtract: (a: number, b: number): number => 0,
  multiply: (a: number, b: number): number => 0,
  divide: (a: number, b: number): number => 0,
});
```

---

## 📚 Next Steps

Now that you understand Direct Exports, proceed to:

**[Type System →](./07-type-system.md)**  
Learn about the advanced TypeScript types that power Zern Kernel's type safety.

---

[← Back to Index](./README.md) | [Next: Type System →](./07-type-system.md)
