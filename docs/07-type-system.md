# Type System

> **Advanced TypeScript types and type-level programming**

Zern Kernel leverages advanced TypeScript features to provide compile-time type safety and automatic type inference throughout the system.

---

## 📦 Overview

**Location:** `src/utils/types.ts`

**Key Techniques:**

- Conditional types
- Mapped types
- Template literal types
- Type inference
- Union to intersection conversion

---

## 🎯 Core Type Utilities

### `PluginNameOf<P>`

Extracts the plugin name from a `BuiltPlugin` type.

```typescript
type PluginNameOf<P> =
  P extends BuiltPlugin<infer N, unknown, unknown> ? (N extends string ? N : never) : never;

// Example:
type MathPlugin = BuiltPlugin<'math', MathAPI, {}>;
type Name = PluginNameOf<MathPlugin>; // 'math'
```

### `PluginExtMapOf<P>`

Extracts the extension map from a `BuiltPlugin` type.

```typescript
type PluginExtMapOf<P> =
  P extends BuiltPlugin<string, unknown, infer M> ? M : never;

// Example:
type Advanced = BuiltPlugin<'advanced', API, { math: { multiply: ... } }>;
type ExtMap = PluginExtMapOf<Advanced>; // { math: { multiply: ... } }
```

### `ExtFor<P, Target>`

Gets extensions for a specific target plugin.

```typescript
type ExtFor<P, Target extends string> =
  PluginExtMapOf<P> extends Record<string, unknown>
    ? Target extends keyof PluginExtMapOf<P>
      ? PluginExtMapOf<P>[Target]
      : unknown
    : unknown;

// Example:
type MathExts = ExtFor<AdvancedPlugin, 'math'>; // { multiply: ... }
```

---

## 🔄 Union to Intersection

The most powerful type transformation in Zern Kernel:

```typescript
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;
```

**What it does:**
Converts a union type to an intersection type.

**Example:**

```typescript
type A = { a: number };
type B = { b: string };

type Union = A | B;
// Union = { a: number } | { b: string }

type Intersection = UnionToIntersection<Union>;
// Intersection = { a: number } & { b: string }
// Intersection = { a: number; b: string }
```

**Why it's needed:**
Extensions from multiple plugins need to be merged into a single object:

```typescript
// Plugin A extends math with { multiply: ... }
// Plugin B extends math with { divide: ... }

// We need: MathAPI & { multiply: ... } & { divide: ... }
// UnionToIntersection makes this possible!
```

---

## 🗺️ Plugins Map

### `ApiForName<U, Name>`

Extracts the API type for a plugin with a specific name.

```typescript
type ApiForName<U, Name extends string> =
  Extract<U, BuiltPlugin<Name, unknown, unknown>> extends infer Match
    ? Match extends BuiltPlugin<Name, infer A, unknown>
      ? A
      : never
    : never;

// Example:
type Plugins = MathPlugin | CalculatorPlugin;
type MathAPI = ApiForName<Plugins, 'math'>;
```

### `ExtensionsForName<U, Name>`

Computes all extensions that apply to a plugin.

```typescript
type ExtensionsForName<U, Name extends string> = UnionToIntersection<ExtFor<U, Name>>;

// Example:
type MathExtensions = ExtensionsForName<AllPlugins, 'math'>;
// MathExtensions = { multiply: ... } & { divide: ... }
```

### `PluginsMap<U>`

The final type that maps plugin names to their complete APIs (base + extensions).

```typescript
type PluginsMap<U> = {
  [K in PluginNameOf<U>]: ApiForName<U, K> & ExtensionsForName<U, K>;
};

// Example:
type AllPlugins = MathPlugin | AdvancedPlugin | CalculatorPlugin;

type FinalMap = PluginsMap<AllPlugins>;
// FinalMap = {
//   math: MathAPI & MathExtensions;
//   advanced: AdvancedAPI;
//   calculator: CalculatorAPI;
// }
```

---

## 🔍 How Type Inference Works

### Step 1: Plugin Registration

```typescript
const k1 = createKernel();
// Type: KernelBuilder<never>

const k2 = k1.use(mathPlugin);
// Type: KernelBuilder<MathPlugin>

const k3 = k2.use(calculatorPlugin);
// Type: KernelBuilder<MathPlugin | CalculatorPlugin>
```

### Step 2: Union Accumulation

Each `.use()` adds the plugin to a union type:

```typescript
type U = MathPlugin | CalculatorPlugin | AdvancedPlugin;
```

### Step 3: Type Transformation

When `.start()` is called, the union is transformed into an object:

```typescript
type Before = MathPlugin | CalculatorPlugin;

type After = PluginsMap<Before>;
// After = {
//   math: MathAPI;
//   calculator: CalculatorAPI;
// }
```

### Step 4: Extension Merging

Extensions are collected and merged:

```typescript
// AdvancedPlugin extends MathPlugin
type AdvancedPlugin = BuiltPlugin<
  'advanced',
  AdvancedAPI,
  { math: { multiply: (...) => number } }
>;

// Result:
type FinalMathAPI = MathAPI & { multiply: (...) => number };
```

---

## 🎨 Advanced Patterns

### Conditional Type Narrowing

```typescript
type ExtractMethodType<TPlugin, TMethodName extends keyof TPlugin> = TPlugin[TMethodName] extends (
  ...args: any[]
) => any
  ? TPlugin[TMethodName]
  : never;

// Ensures we only get method types
type AddMethod = ExtractMethodType<MathAPI, 'add'>;
// AddMethod = (a: number, b: number) => number
```

### Template Literal Types

```typescript
type PluginEvent<TName extends string> = `plugin:${TName}:loaded`;

type MathEvent = PluginEvent<'math'>;
// MathEvent = 'plugin:math:loaded'
```

### Recursive Types

```typescript
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Makes all properties optional, recursively
type PartialConfig = DeepPartial<KernelConfig>;
```

---

## 🔧 Wrapper Type System

### Auto-Typed Wrapper Context

```typescript
interface AutoTypedWrapperContext<TMethod extends (...args: any[]) => any, TExtensions = {}> {
  readonly pluginName: string;
  readonly methodName: string;
  readonly originalMethod: TMethod;
  readonly args: Parameters<TMethod>;
  [key: string]: any; // Allow dynamic properties
}
```

**Benefits:**

- `args` is automatically typed as `Parameters<TMethod>`
- Return type is inferred as `ReturnType<TMethod>`
- Custom properties can be added dynamically

### Auto-Typed Wrapper Config

```typescript
interface AutoTypedWrapperConfig<TMethod extends (...args: any[]) => any, TExtensions = {}> {
  readonly before?: (
    context: AutoTypedWrapperContext<TMethod, TExtensions>
  ) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;

  readonly after?: (
    result: Awaited<ReturnType<TMethod>>,
    context: Omit<AutoTypedWrapperContext<TMethod, TExtensions>, 'args'>
  ) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

  readonly around?: (
    context: AutoTypedWrapperContext<TMethod, TExtensions>
  ) => AutoTypedWrapperResult<TMethod> | Promise<AutoTypedWrapperResult<TMethod>>;
}
```

---

## 📊 Type Complexity Analysis

### Simple Types (Low Complexity)

```typescript
type PluginId = string & { readonly __brand: 'PluginId' };
type Version = string & { readonly __brand: 'Version' };
```

**Complexity:** O(1)  
**Purpose:** Type safety for primitives

### Medium Types (Medium Complexity)

```typescript
type PluginNameOf<P> =
  P extends BuiltPlugin<infer N, unknown, unknown> ? (N extends string ? N : never) : never;
```

**Complexity:** O(1) per plugin  
**Purpose:** Extract plugin names

### Complex Types (High Complexity)

```typescript
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;
```

**Complexity:** O(n) where n = union members  
**Purpose:** Merge extensions

### Very Complex Types (Very High Complexity)

```typescript
type PluginsMap<U> = {
  [K in PluginNameOf<U>]: ApiForName<U, K> & ExtensionsForName<U, K>;
};
```

**Complexity:** O(n²) where n = plugin count  
**Purpose:** Final type with all plugins and extensions

---

## ⚡ Performance Considerations

### Type Checking Performance

TypeScript's type checker has limits:

```typescript
// ✅ Good - Fast type checking
type SmallUnion = A | B | C;

// ⚠️ Slow - Many plugins
type LargeUnion = P1 | P2 | P3 | ... | P100;

// 💡 Tip: Group plugins into modules
type CorePlugins = P1 | P2 | P3;
type FeaturePlugins = P4 | P5 | P6;
type AllPlugins = CorePlugins | FeaturePlugins;
```

### Instantiation Depth

TypeScript has a recursion limit:

```typescript
// ⚠️ Can hit depth limit with many extensions
type DeepExtensions = Ext1 & Ext2 & Ext3 & ... & Ext50;

// 💡 Tip: Limit extension depth
```

---

## ✅ Best Practices

### 1. Use Type Aliases for Clarity

✅ **Good:**

```typescript
type MathAPI = ReturnType<typeof mathPlugin.setupFn>;
type CalculatorAPI = ReturnType<typeof calculatorPlugin.setupFn>;
```

❌ **Bad:**

```typescript
// Inline types everywhere
const math: ReturnType<typeof mathPlugin.setupFn> = kernel.get('math');
```

### 2. Avoid Type Assertions

✅ **Good:**

```typescript
const math = kernel.get('math');
// Type is automatically inferred
```

❌ **Bad:**

```typescript
const math = kernel.get('math') as MathAPI;
// Manual type assertion
```

### 3. Leverage Type Inference

✅ **Good:**

```typescript
.wrap(mathPlugin, 'add', {
  before: (context) => {
    // context.args is automatically [number, number]
    const [a, b] = context.args;
    return { shouldCallOriginal: true };
  },
});
```

❌ **Bad:**

```typescript
.wrap(mathPlugin, 'add', {
  before: (context: WrapperContext<[number, number], number>) => {
    // Manual type annotation
    return { shouldCallOriginal: true };
  },
});
```

### 4. Document Complex Types

✅ **Good:**

```typescript
/**
 * Converts a union type to an intersection type.
 * Used to merge extensions from multiple plugins.
 *
 * @example
 * UnionToIntersection<{ a: number } | { b: string }>
 * // Result: { a: number; b: string }
 */
type UnionToIntersection<U> = /* ... */;
```

---

## 🔍 Deep Dive: Type Inference Magic

### How `.use()` Builds Types

```typescript
class KernelBuilderImpl<U extends BuiltPlugin<string, unknown, unknown> = never> {
  use<P extends BuiltPlugin<string, unknown, unknown>>(plugin: P): KernelBuilder<U | P> {
    // U | P creates a union type
    return this as unknown as KernelBuilder<U | P>;
  }
}

// Usage:
const k = createKernel() // KernelBuilder<never>
  .use(mathPlugin) // KernelBuilder<MathPlugin>
  .use(calculatorPlugin); // KernelBuilder<MathPlugin | CalculatorPlugin>
```

### How `.get()` Resolves Types

```typescript
interface Kernel<TPlugins> {
  get<TName extends keyof TPlugins>(name: TName): TPlugins[TName];
}

// Usage:
const kernel: Kernel<{ math: MathAPI; calc: CalcAPI }> = /* ... */;

const math = kernel.get('math');
// TypeScript knows:
// - TPlugins = { math: MathAPI; calc: CalcAPI }
// - TName = 'math'
// - TPlugins[TName] = TPlugins['math'] = MathAPI
// - Return type = MathAPI
```

---

## 📚 Next Steps

Now that you understand the Type System, proceed to:

**[Utilities →](./08-utilities.md)**  
Learn about helper functions, validators, and API combinators.

---

[← Back to Index](./README.md) | [Next: Utilities →](./08-utilities.md)
