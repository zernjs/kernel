# Zern Kernel Documentation

> **A powerful, type-safe plugin orchestration system for TypeScript**

Welcome to the Zern Kernel documentation! This comprehensive guide will help you understand and master every aspect of the kernel, from basic concepts to advanced patterns.

---

## 📖 Table of Contents

### Getting Started

- [**Architecture Overview**](./01-architecture-overview.md) - Understand the big picture and core concepts

### Core Layers

1. [**Core Layer**](./02-core-layer.md) - Fundamental types, error handling, and the Result pattern
2. [**Plugin System**](./03-plugin-system.md) - Creating, building, and managing plugins
3. [**Kernel Layer**](./04-kernel-layer.md) - Kernel initialization, lifecycle, and container management
4. [**Extension System**](./05-extension-system.md) - Extending plugin APIs with new methods
5. [**Direct Exports**](./06-direct-exports.md) - Library-like direct method imports with full type safety
6. [**Lifecycle Hooks**](./11-lifecycle-hooks.md) - Managing plugin initialization, shutdown, and errors

### Advanced Topics

7. [**Type System**](./07-type-system.md) - Advanced TypeScript types and type-level programming
8. [**Utilities**](./08-utilities.md) - Helper functions, validators, and API combinators
9. [**API Reference**](./09-api-reference.md) - Complete API documentation
10. [**Best Practices**](./10-best-practices.md) - Patterns, guidelines, and recommendations
11. [**Proxy System**](./12-proxy-system.md) - Intercepting and modifying plugin method behavior
12. [**Store System**](./13-store-system.md) - Reactive state management with automatic change tracking

---

## 🎯 What is Zern Kernel?

Zern Kernel is a **plugin orchestration system** that provides:

✅ **Type-Safe Plugin Management** - Full TypeScript inference and autocomplete  
✅ **Dependency Resolution** - Automatic topological sorting with version checking  
✅ **Reactive Store System** - Automatic state management with watchers and computed values  
✅ **API Extension** - Plugins can extend other plugins' APIs at runtime  
✅ **Method Proxying** - Intercept and modify plugin behavior with before/after/around hooks  
✅ **Lifecycle Hooks** - onInit, onReady, onShutdown, and onError hooks  
✅ **Result Pattern** - Functional error handling without exceptions  
✅ **Direct Exports** - Import plugin methods like a normal library

---

## 🚀 Quick Start

```typescript
import { createKernel, plugin } from '@zern/kernel';

// 1. Define plugins
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
}));

// 2. Initialize kernel
export const kernel = await createKernel().use(mathPlugin).start();

// 3. Use with full type safety!
const math = kernel.get('math');
console.log(math.add(2, 3)); // ✅ Autocomplete works!
```

---

## 📚 Reading Guide

This documentation is organized in a **layered approach**, from bottom to top:

### For Beginners

1. Start with [Architecture Overview](./01-architecture-overview.md) to understand the big picture
2. Read [Core Layer](./02-core-layer.md) to understand fundamental concepts
3. Follow [Plugin System](./03-plugin-system.md) to learn how to create plugins
4. Explore [Best Practices](./10-best-practices.md) for recommended patterns

### For Advanced Users

1. Deep dive into [Extension System](./05-extension-system.md) for plugin extensions
2. Master [Type System](./07-type-system.md) for advanced type manipulation
3. Reference [API Reference](./09-api-reference.md) for complete API details

### For Contributors

1. Study [Architecture Overview](./01-architecture-overview.md) for system design
2. Review all layer documentation for implementation details
3. Follow [Best Practices](./10-best-practices.md) for coding guidelines

---

## 🏗️ Architecture Layers

```
┌──────────────────────────────────────────────────┐
│          Application Layer                        │
│     (Your plugins and business logic)            │
└──────────────────────────────────────────────────┘
                      ▲
                      │
┌──────────────────────────────────────────────────┐
│          Direct Exports Layer                     │
│   (createDirectExports, createDirectMethod)      │
└──────────────────────────────────────────────────┘
                      ▲
                      │
┌──────────────────────────────────────────────────┐
│          Extension Layer                          │
│   (API Extensions, Method Proxies)               │
└──────────────────────────────────────────────────┘
                      ▲
                      │
┌──────────────────────────────────────────────────┐
│          Kernel Layer                             │
│   (Lifecycle, Container, Builder)                │
└──────────────────────────────────────────────────┘
                      ▲
                      │
┌──────────────────────────────────────────────────┐
│          Plugin Layer                             │
│   (Builder, Registry, Resolver)                  │
└──────────────────────────────────────────────────┘
                      ▲
                      │
┌──────────────────────────────────────────────────┐
│          Store Layer                              │
│   (Reactive State, Watchers, Computed)           │
└──────────────────────────────────────────────────┘
                      ▲
                      │
┌──────────────────────────────────────────────────┐
│          Core Layer                               │
│   (Types, Result, Errors)                        │
└──────────────────────────────────────────────────┘
```

---

## 🎓 Learning Path

Follow this recommended learning path:

1. **[Architecture Overview →](./01-architecture-overview.md)**  
   Get the big picture of how Zern Kernel works

2. **[Core Layer →](./02-core-layer.md)**  
   Learn the foundational concepts and patterns

3. **[Plugin System →](./03-plugin-system.md)**  
   Master plugin creation and configuration

4. **[Store System →](./13-store-system.md)**  
   Reactive state management with watchers and computed values

5. **[Kernel Layer →](./04-kernel-layer.md)**  
   Understand kernel initialization and lifecycle

6. **[Extension System →](./05-extension-system.md)**  
   Learn how to extend plugin APIs with new methods

7. **[Direct Exports →](./06-direct-exports.md)**  
   Create library-like exports for your plugins

8. **[Lifecycle Hooks →](./11-lifecycle-hooks.md)**  
   Manage plugin initialization, shutdown, and errors

9. **[Proxy System →](./12-proxy-system.md)**  
   Intercept and modify plugin method behavior

10. **[Type System →](./07-type-system.md)**  
    Advanced type-level programming techniques

11. **[Best Practices →](./10-best-practices.md)**  
    Apply recommended patterns and guidelines

---

## 🔗 Additional Resources

- **[Examples Directory](../examples/)** - Working code examples
- **[Source Code](../src/)** - Implementation details
- **[API Reference](./09-api-reference.md)** - Complete API documentation

---

## 📝 Documentation Conventions

Throughout this documentation, you'll find:

- **💡 Tip** - Helpful hints and recommendations
- **⚠️ Warning** - Important caveats and gotchas
- **✅ Good** - Recommended patterns
- **❌ Bad** - Anti-patterns to avoid
- **🔍 Deep Dive** - Advanced topics and internals

---

## 🚦 Ready to Start?

Begin your journey with the **[Architecture Overview →](./01-architecture-overview.md)**

This will give you a solid understanding of the system's design and core concepts before diving into specific layers.

---

**Happy coding with Zern Kernel!** 🎉
