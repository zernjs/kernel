# Extension System

> **Extending plugin APIs by adding new methods at runtime**

The Extension System allows plugins to dynamically add new methods to other plugins' APIs, enabling modular and composable architectures.

---

## 📦 Overview

**Location:** `src/extension/`

**Key Components:**

- `ExtensionManager` - Manages extensions and applies them to plugins
- `PluginExtension` - Metadata for registered extensions

**Capabilities:**

- ✅ Add new methods to existing plugins (`.extend()`)
- ✅ Multiple plugins can extend the same target
- ✅ Full type safety with automatic inference
- ✅ Extensions are applied during plugin initialization

---

## 🔧 Basic Extension

### Adding Methods to Another Plugin

```typescript
const advancedMathPlugin = plugin('advanced-math', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .extend(mathPlugin, mathApi => ({
    // Add new methods to math plugin
    multiply: (a: number, b: number) => a * b,
    power: (base: number, exp: number) => Math.pow(base, exp),
  }))
  .setup(() => ({
    // Advanced math's own API
    factorial: (n: number) => (n <= 1 ? 1 : n * factorial(n - 1)),
  }));

// After kernel initialization:
const math = kernel.get('math');
math.add(2, 3); // ✅ Original method
math.multiply(2, 3); // ✅ Extended method!
math.power(2, 8); // ✅ Extended method!

const advanced = kernel.get('advanced-math');
advanced.factorial(5); // ✅ Own method
```

**Key Points:**

- Extensions are specified with `.extend()`
- Extended methods become part of the target plugin's API
- Original plugin has no knowledge of extensions
- Full type safety is preserved

---

## 🔗 Multiple Extensions

Multiple plugins can extend the same target:

```typescript
// Plugin A extends math
const pluginA = plugin('a', '1.0.0')
  .extend(mathPlugin, () => ({
    multiply: (a: number, b: number) => a * b,
  }))
  .setup(() => ({}));

// Plugin B also extends math
const pluginB = plugin('b', '1.0.0')
  .extend(mathPlugin, () => ({
    divide: (a: number, b: number) => a / b,
  }))
  .setup(() => ({}));

// After kernel init:
const math = kernel.get('math');
math.add(1, 2); // ✅ Original method
math.multiply(2, 3); // ✅ From plugin A
math.divide(10, 2); // ✅ From plugin B
```

**Result:** The target plugin's API is merged with all extensions!

---

## 🎯 Using Original API

Extensions can access and use the original plugin's API:

```typescript
const enhancedPlugin = plugin('enhanced', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .extend(mathPlugin, mathApi => ({
    // Use original API inside extension
    multiplyBy10: (x: number) => mathApi.add(x, x * 9),
    addThenDouble: (a: number, b: number) => {
      const sum = mathApi.add(a, b);
      return sum * 2;
    },
    // Compose original methods
    square: (x: number) => {
      // Assuming multiply is also extended
      return mathApi.multiply(x, x);
    },
  }))
  .setup(() => ({}));
```

**Key Point:** The `mathApi` parameter provides type-safe access to the original API!

---

## 🔍 Extension Lifecycle

### When Extensions Are Applied

```
1. Kernel starts
   ↓
2. Plugins registered in container
   ↓
3. Dependencies resolved
   ↓
4. Extensions registered in ExtensionManager
   ↓
5. Plugins initialized in dependency order
   ↓
6. For each plugin:
   - Execute setup() to get base API
   - Apply all extensions
   - Result: Extended API
   ↓
7. Kernel ready
```

### Extension Application

```typescript
// Original API
const baseApi = {
  add: (a, b) => a + b,
};

// Extensions from other plugins
const extensions = [{ multiply: (a, b) => a * b }, { divide: (a, b) => a / b }];

// Final API (merged)
const finalApi = {
  add: (a, b) => a + b, // ✅ Original
  multiply: (a, b) => a * b, // ✅ Extended
  divide: (a, b) => a / b, // ✅ Extended
};
```

---

## 🏗️ Real-World Examples

### Example 1: String Calculator Extension

Extend a basic `stringPlugin` with calculator functionality:

```typescript
const stringPlugin = plugin('string', '1.0.0').setup(() => ({
  split: (str: string, delimiter: string) => str.split(delimiter),
  join: (parts: string[], delimiter: string) => parts.join(delimiter),
  trim: (str: string) => str.trim(),
}));

const calculatorPlugin = plugin('calculator', '1.0.0')
  .depends(stringPlugin, '^1.0.0')
  .extend(stringPlugin, stringApi => ({
    // Add calculator to string plugin!
    calculate: (expression: string): number => {
      // "2 + 3" → 5
      const parts = stringApi.split(expression, ' ');
      const [a, op, b] = parts;
      const numA = parseInt(a);
      const numB = parseInt(b);

      switch (op) {
        case '+':
          return numA + numB;
        case '-':
          return numA - numB;
        case '*':
          return numA * numB;
        case '/':
          return numA / numB;
        default:
          throw new Error(`Unknown operator: ${op}`);
      }
    },
  }))
  .setup(() => ({}));

// Usage:
const str = kernel.get('string');
str.calculate('2 + 3'); // 5 ✅
str.split('a,b,c', ','); // ['a', 'b', 'c'] ✅
```

### Example 2: HTTP Client with Retry Extension

```typescript
const httpPlugin = plugin('http', '1.0.0').setup(() => ({
  get: async (url: string) => fetch(url),
  post: async (url: string, data: any) =>
    fetch(url, { method: 'POST', body: JSON.stringify(data) }),
}));

const retryPlugin = plugin('retry', '1.0.0')
  .depends(httpPlugin, '^1.0.0')
  .extend(httpPlugin, httpApi => ({
    // Add retry capability
    getWithRetry: async (url: string, maxRetries = 3) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await httpApi.get(url);
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await sleep(1000 * (i + 1)); // Exponential backoff
        }
      }
    },
  }))
  .setup(() => ({}));

// Usage:
const http = kernel.get('http');
await http.get('/api/data'); // ✅ Original
await http.getWithRetry('/api/data'); // ✅ With retry!
```

### Example 3: Validation Extension

```typescript
const formPlugin = plugin('form', '1.0.0').setup(() => ({
  getValue: (fieldId: string) => document.getElementById(fieldId)?.value,
  setValue: (fieldId: string, value: string) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = value;
  },
}));

const validationPlugin = plugin('validation', '1.0.0')
  .depends(formPlugin, '^1.0.0')
  .extend(formPlugin, formApi => ({
    // Add validation methods
    isRequired: (fieldId: string): boolean => {
      const value = formApi.getValue(fieldId);
      return value !== null && value !== undefined && value.trim() !== '';
    },
    isEmail: (fieldId: string): boolean => {
      const value = formApi.getValue(fieldId);
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
    },
    isMinLength: (fieldId: string, min: number): boolean => {
      const value = formApi.getValue(fieldId);
      return (value || '').length >= min;
    },
  }))
  .setup(() => ({}));

// Usage:
const form = kernel.get('form');
form.getValue('email'); // ✅ Original
form.isEmail('email'); // ✅ Extended validation!
form.isRequired('name'); // ✅ Extended validation!
```

---

## 🔐 Type Safety

### Automatic Type Inference

```typescript
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
}));

const advancedPlugin = plugin('advanced', '1.0.0')
  .extend(mathPlugin, mathApi => {
    // TypeScript knows mathApi structure!
    type MathAPI = typeof mathApi;
    // MathAPI = { add: (a: number, b: number) => number }

    return {
      multiply: (a: number, b: number) => a * b,
    };
  })
  .setup(() => ({}));

// After kernel init:
const math = kernel.get('math');
// Type: { add: ..., multiply: ... } ✅
```

### Extension Type Merging

The kernel automatically merges extension types:

```typescript
const pluginA = plugin('a', '1.0.0')
  .extend(mathPlugin, () => ({
    multiply: (a: number, b: number) => a * b,
  }))
  .setup(() => ({}));

const pluginB = plugin('b', '1.0.0')
  .extend(mathPlugin, () => ({
    divide: (a: number, b: number) => a / b,
  }))
  .setup(() => ({}));

// After init:
const math = kernel.get('math');
// Type: {
//   add: (a: number, b: number) => number,      // Original
//   multiply: (a: number, b: number) => number, // From A
//   divide: (a: number, b: number) => number,   // From B
// }
```

---

## ✅ Best Practices

### 1. Use Extensions for Related Functionality

✅ **Good** - Extending with related features:

```typescript
.extend(mathPlugin, () => ({
  multiply: (a, b) => a * b,  // ✅ Math-related
  power: (base, exp) => Math.pow(base, exp), // ✅ Math-related
}))
```

❌ **Bad** - Extending with unrelated features:

```typescript
.extend(mathPlugin, () => ({
  fetchUser: (id) => fetch(`/api/users/${id}`), // ❌ Not math-related!
  logMessage: (msg) => console.log(msg), // ❌ Not math-related!
}))
```

### 2. Keep Extensions Focused

✅ **Good:**

```typescript
.extend(plugin, api => ({
  singlePurposeMethod: () => { /* focused logic */ },
}))
```

❌ **Bad:**

```typescript
.extend(plugin, api => ({
  doEverything: () => {
    // Too many responsibilities!
    validateData();
    transformData();
    saveToDatabase();
    sendNotification();
    logActivity();
  },
}))
```

### 3. Declare Dependencies

✅ **Good:**

```typescript
plugin('extension', '1.0.0')
  .depends(targetPlugin, '^1.0.0') // ✅ Explicit dependency
  .extend(targetPlugin, api => ({ ... }))
  .setup(() => ({}));
```

❌ **Bad:**

```typescript
plugin('extension', '1.0.0')
  .extend(targetPlugin, api => ({ ... })) // ❌ No dependency declared
  .setup(() => ({}));
```

### 4. Type Your Extensions

✅ **Good:**

```typescript
interface MathExtensions {
  multiply: (a: number, b: number) => number;
  power: (base: number, exp: number) => number;
}

.extend(mathPlugin, (api): MathExtensions => ({
  multiply: (a, b) => a * b,
  power: (base, exp) => Math.pow(base, exp),
}))
```

### 5. Use Original API Wisely

✅ **Good:**

```typescript
.extend(mathPlugin, mathApi => ({
  // Compose using original methods
  square: (x) => mathApi.add(x * x - x, x),
}))
```

❌ **Bad:**

```typescript
.extend(mathPlugin, mathApi => ({
  // Reimplementing what already exists
  add: (a, b) => a + b, // ❌ Already exists in original!
}))
```

---

## 🆚 Extension vs Proxy

| Feature      | Extension            | Proxy                        |
| ------------ | -------------------- | ---------------------------- |
| **Purpose**  | Add new methods      | Intercept existing methods   |
| **Modifies** | API surface          | Behavior                     |
| **When**     | Build time           | Runtime                      |
| **Use For**  | Adding functionality | Logging, caching, validation |

**Example:**

```typescript
// Extension: Adds NEW method
.extend(mathPlugin, api => ({
  multiply: (a, b) => a * b, // ✅ New method
}))

// Proxy: Intercepts EXISTING method
.proxy(mathPlugin, {
  methods: 'add',
  before: ctx => console.log('add called'), // ✅ Intercepts existing
})
```

---

## 🔍 How Extensions Work Internally

### 1. Registration

```typescript
// When plugin.extend() is called:
const extension: PluginExtension = {
  targetPluginId: mathPlugin.id,
  extensionFn: api => ({ multiply: (a, b) => a * b }),
};

// Stored in ExtensionManager
extensionManager.registerExtension(extension);
```

### 2. Application

```typescript
// During plugin initialization:
const baseApi = mathPlugin.setupFn(context);
// baseApi = { add: (a, b) => a + b }

const extensions = extensionManager.getExtensions('math');
// extensions = [{ multiply: ... }, { divide: ... }]

const extendedApi = {
  ...baseApi,
  ...extensions[0], // { multiply: ... }
  ...extensions[1], // { divide: ... }
};

// Result: { add, multiply, divide }
```

---

## 📚 Next Steps

Now that you understand the Extension System, proceed to:

**[Proxy System →](./12-proxy-system.md)**  
Learn how to intercept and modify plugin method behavior at runtime.

---

[← Back to Index](./README.md) | [Next: Proxy System →](./12-proxy-system.md)
