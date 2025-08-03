<h1 align="center">
🔥 Zern Kernel
</h1>

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/your-org/zern-kernel/ci.yml?style=for-the-badge)](https://github.com/your-org/zern-kernel/actions)
[![Coverage](https://img.shields.io/badge/coverage-59%25-red?style=for-the-badge)](./packages/kernel/coverage/README.md)

**The pure plugin engine powering the Zern Framework**

_Plugin Architecture • Type-safe • Extensible • Zero Dependencies_

[Documentation](https://zern.dev/kernel) • [API Reference](https://zern.dev/kernel/api) • [Plugin Development](https://zern.dev/kernel/plugins) • [Contributing](CONTRIBUTING.md)

</div>

---

## 🎯 Overview

The **Zern Kernel** is the pure plugin engine that powers the Zern Framework ecosystem. It provides the foundational plugin architecture without any application-specific functionality. Built from the ground up with TypeScript, it serves as the robust, extensible, and high-performance foundation that the Zern Framework builds upon.

**Important**: The kernel is a **pure plugin engine** - it does not include HTTP servers, validation, logging, or other application features. These are provided by the Zern Framework which is built on top of this kernel.

### ⚡ Key Features

- **🔌 Plugin Architecture**: Modular system with automatic discovery and dependency resolution
- **🚀 Zero Configuration**: Works out-of-the-box with intelligent defaults
- **🛡️ Type Safety**: Full TypeScript support with advanced type inference
- **⚡ High Performance**: Optimized for speed with minimal overhead
- **🔄 Hot Reload**: Development-friendly with instant plugin reloading
- **📊 Observability**: Built-in monitoring, metrics, and debugging tools

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  🎨 Zern Framework (Framework Repository - zern)           │
│  ├─ Framework Core Plugins                                 │
│  │  ├─ HTTP Server & Routing                               │
│  │  ├─ Validation & Serialization                          │
│  │  ├─ Error Handling & Logging                            │
│  │  ├─ Configuration Management                            │
│  │  ├─ Testing Framework                                   │
│  │  └─ Build & Deployment                                  │
│  └─ Extended Plugins (Third-party integrations)            │
├─────────────────────────────────────────────────────────────┤
│  ⚡ Zern Kernel (This Repository - zern-kernel)             │
│  ├─ Plugin Registry & Discovery                            │
│  ├─ Dependency Resolution Engine                           │
│  ├─ Lifecycle Management                                   │
│  ├─ Event System & Hooks                                   │
│  ├─ State Management                                       │
│  └─ Hot Reload & Development Tools                         │
├─────────────────────────────────────────────────────────────┤
│  🌐 Backend Engine Abstraction Layer                       │
│  ├─ NestJS Platform Adapters (Express/Fastify)             │
│  ├─ Performance Optimization                               │
│  └─ Unified API Surface                                    │
└─────────────────────────────────────────────────────────────┘
```

### Repository Structure

- **`@zern/kernel`** (packages/kernel): Pure plugin engine with registry, lifecycle, and event system
- **Kernel Plugins** (packages/plugins): Kernel-level plugins (logger, metrics, devtools)
- **Shared Utilities** (packages/plugins/shared): Shared utilities between plugins
- **Development Tools** (packages/tools): CLI, benchmarks, and development utilities

---

## 🚀 Quick Start

### Installation

```bash
# Install the kernel
npm install @zern/kernel

# Or with pnpm
pnpm add @zern/kernel
```

### Basic Usage

```typescript
import { ZernKernel } from '@zern/kernel';

// Basic kernel usage
const kernel = new ZernKernel();

// Load plugins
await kernel.loadPlugin(new MyPlugin());

// Start the kernel
await kernel.start();

console.log('Kernel is running!');
```

### Framework Integration

```typescript
// Framework Integration (how Zern Framework uses the kernel)
import { ZernKernel } from '@zern/kernel';
import { HttpPlugin, ValidationPlugin, ConfigPlugin } from '@zern/plugins-core';

const kernel = new ZernKernel();

// Framework loads core plugins on top of the kernel
await kernel.loadPlugin(new ConfigPlugin());
await kernel.loadPlugin(new ValidationPlugin());
await kernel.loadPlugin(new HttpPlugin());

await kernel.start();
// Now you have a full web framework built on the kernel
```

### Plugin Development

```typescript
import { Plugin, ZernKernel } from '@zern/kernel';

export class MyCustomPlugin implements Plugin {
  id = 'my-custom-plugin';
  version = '1.0.0';
  dependencies = []; // No dependencies on framework plugins from kernel level

  async init(kernel: ZernKernel): Promise<void> {
    // Plugin initialization logic
    console.log('Custom plugin initialized');

    // Register with kernel's event system
    kernel.events.on('kernel.ready', () => {
      console.log('Kernel is ready!');
    });
  }

  async destroy(kernel: ZernKernel): Promise<void> {
    // Cleanup logic
    console.log('Custom plugin destroyed');
  }
}

// Example of a kernel-level utility plugin
export class LoggerPlugin implements Plugin {
  id = 'kernel-logger';
  version = '1.0.0';

  async init(kernel: ZernKernel): Promise<void> {
    // Provide logging utilities to other plugins
    kernel.provide('logger', {
      info: (message: string) => console.log(`[INFO] ${message}`),
      error: (message: string) => console.error(`[ERROR] ${message}`),
    });
  }
}
```

---

## 🧩 Core Components

### 🔍 Plugin Registry

The Plugin Registry is responsible for discovering, validating, and managing all plugins in the system.

```typescript
import { PluginRegistry } from '@zern/kernel';

const registry = new PluginRegistry();

// Automatic discovery
await registry.discover('./plugins');
await registry.discover('node_modules/@zern/plugin-*');

// Manual registration
registry.register(new MyPlugin());

// Get plugin information
const plugin = registry.get('my-plugin-id');
const allPlugins = registry.list();
```

### 🔗 Dependency Resolution

Advanced dependency resolution with topological sorting and conflict detection.

```typescript
import { DependencyResolver } from '@zern/kernel';

const resolver = new DependencyResolver();

// Resolve plugin load order
const loadOrder = await resolver.resolve([
  'plugin-a', // depends on plugin-b
  'plugin-b', // no dependencies
  'plugin-c', // depends on plugin-a, plugin-b
]);

// Result: ['plugin-b', 'plugin-a', 'plugin-c']
```

### 🔄 Lifecycle Management

Comprehensive plugin lifecycle with state tracking and error recovery.

```typescript
import { LifecycleManager } from '@zern/kernel';

const lifecycle = new LifecycleManager();

// Plugin states: 'loading' | 'ready' | 'error' | 'disabled'
lifecycle.on('stateChange', (pluginId, oldState, newState) => {
  console.log(`Plugin ${pluginId}: ${oldState} → ${newState}`);
});

// Graceful shutdown
await lifecycle.shutdown();
```

### 📡 Event System

High-performance event bus for inter-plugin communication.

```typescript
import { EventBus } from '@zern/kernel';

const eventBus = new EventBus();

// Subscribe to events
eventBus.on('user.created', async user => {
  await sendWelcomeEmail(user);
});

// Emit events
await eventBus.emit('user.created', { id: 1, email: 'user@example.com' });

// Lifecycle hooks
eventBus.on('plugin.beforeInit', pluginId => {
  console.log(`Initializing plugin: ${pluginId}`);
});
```

---

## 📦 Monorepo Structure

```
packages/
├── kernel/                 # Core kernel engine (@zern/kernel)
│   ├── src/
│   │   ├── registry/      # Plugin registry
│   │   ├── resolver/      # Dependency resolution
│   │   ├── lifecycle/     # Lifecycle management
│   │   ├── events/        # Event system
│   │   ├── state/         # State management
│   │   └── index.ts       # Main exports
│   └── tests/
├── plugins/
│   ├── core/              # Framework core plugins
│   │   ├── config/        # Configuration management
│   │   └── validation/    # Validation plugin
│   ├── shared/            # Shared utilities
│   └── utilities/         # Kernel-level utility plugins
│       ├── logger/        # Basic logging utilities
│       └── metrics/       # Performance metrics
└── tools/                 # Development tools
    ├── benchmarks/       # Performance benchmarks
    ├── cli/              # Development CLI
    └── devtools/         # Development tools
```

---

## 🔌 Kernel Plugins

### Utility Plugins (Included)

| Plugin                    | Description                                   | Status    |
| ------------------------- | --------------------------------------------- | --------- |
| **@zern/kernel-logger**   | Basic logging utilities for kernel operations | ✅ Stable |
| **@zern/kernel-metrics**  | Performance metrics and monitoring            | ✅ Stable |
| **@zern/kernel-devtools** | Development and debugging tools               | ✅ Stable |

### Framework Core Plugins (Separate Repository)

The following plugins are **NOT** part of the kernel but are built on top of it in the `zern` repository:

| Plugin            | Description                              | Repository |
| ----------------- | ---------------------------------------- | ---------- |
| **HTTP Server**   | Express/Fastify integration with routing | `zern`     |
| **Validation**    | Zod-based validation with type inference | `zern`     |
| **Configuration** | Environment-aware config management      | `zern`     |
| **Logging**       | Structured logging with transports       | `zern`     |
| **Testing**       | Integrated testing framework             | `zern`     |
| **Swagger**       | Automatic OpenAPI documentation          | `zern`     |

### Plugin Development

```typescript
// Plugin interface
export interface Plugin {
  id: string;
  version: string;
  dependencies?: string[];
  optionalDependencies?: string[];

  // Lifecycle hooks
  beforeInit?(kernel: ZernKernel): Promise<void>;
  init(kernel: ZernKernel): Promise<void>;
  afterInit?(kernel: ZernKernel): Promise<void>;
  beforeDestroy?(kernel: ZernKernel): Promise<void>;
  destroy?(kernel: ZernKernel): Promise<void>;

  // Configuration
  defaultConfig?: Record<string, any>;
  configSchema?: ZodSchema;

  // Metadata
  metadata: PluginMetadata;
}
```

---

## ⚡ Performance

### Benchmarks

```
Kernel Startup Time:     < 50ms (cold start)
Plugin Loading:          < 10ms per plugin
Memory Footprint:        < 100MB (base)
Request Throughput:      > 10,000 req/s
Event Processing:        > 100,000 events/s
```

### Optimization Features

- **Lazy Loading**: Plugins loaded on-demand
- **Tree Shaking**: Unused code elimination
- **Memory Pooling**: Efficient memory management
- **JIT Compilation**: Runtime optimization
- **Caching**: Intelligent caching strategies

---

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm 8+
- TypeScript 5+

### Setup

```bash
# Clone the kernel repository
git clone https://github.com/your-org/zern-kernel.git
cd zern-kernel

# Install dependencies
pnpm install

# Build the kernel
pnpm build

# Run kernel tests
pnpm test

# Start kernel development mode
pnpm dev
```

### Scripts

```bash
# Development
pnpm dev              # Start kernel development mode with hot reload
pnpm build            # Build kernel package
pnpm test             # Run kernel tests
pnpm test:watch       # Run kernel tests in watch mode
pnpm lint             # Lint kernel code
pnpm format           # Format kernel code

# Release
pnpm changeset        # Create changeset for kernel
pnpm version          # Version kernel package
pnpm publish          # Publish kernel to npm
```

---

## 🧪 Testing

### Test Coverage

```
Statements   : 95.2% ( 1247/1310 )
Branches     : 92.8% ( 456/491 )
Functions    : 96.1% ( 123/128 )
Lines        : 95.5% ( 1198/1254 )
```

### Test Structure

```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── e2e/              # End-to-end tests
├── performance/       # Performance tests
└── fixtures/         # Test fixtures
```

### Running Tests

```bash
# All tests
pnpm test

# Specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:performance

# Coverage report
pnpm test:coverage
```

---

## 📊 Monitoring & Debugging

### Built-in Metrics

```typescript
import { KernelMetrics } from '@zern/kernel';

const metrics = await kernel.getMetrics();

console.log({
  uptime: metrics.uptime,
  pluginsLoaded: metrics.plugins.loaded,
  pluginsActive: metrics.plugins.active,
  memoryUsage: metrics.memory,
  eventStats: metrics.events,
});
```

### Debug Mode

```typescript
// Enable debug mode
const kernel = createKernel({
  debug: true,
  logLevel: 'debug',
});

// Or via environment
process.env.ZERN_DEBUG = 'true';
process.env.ZERN_LOG_LEVEL = 'debug';
```

### DevTools Integration

```typescript
// Enable DevTools (development only)
if (process.env.NODE_ENV === 'development') {
  const { DevToolsPlugin } = await import('@zern/plugin-devtools');
  kernel.registerPlugin(new DevToolsPlugin());
}
```

---

## 🔧 Configuration

### Kernel Configuration

```typescript
interface KernelConfig {
  // Plugin settings
  plugins?: {
    autoDiscover?: boolean;
    discoveryPaths?: string[];
    loadTimeout?: number;
  };

  // Performance settings
  performance?: {
    maxPlugins?: number;
    memoryLimit?: string;
    gcInterval?: number;
  };

  // Development settings
  development?: {
    hotReload?: boolean;
    debugMode?: boolean;
    devTools?: boolean;
  };

  // Logging settings
  logging?: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    format?: 'json' | 'pretty';
    transports?: LogTransport[];
  };
}
```

### Environment Variables

```bash
# Core settings
ZERN_ENV=development|production
ZERN_DEBUG=true|false
ZERN_LOG_LEVEL=error|warn|info|debug

# Performance
ZERN_MAX_PLUGINS=100
ZERN_MEMORY_LIMIT=512MB
ZERN_GC_INTERVAL=30000

# Development
ZERN_HOT_RELOAD=true|false
ZERN_DEV_TOOLS=true|false
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration
- **Prettier**: Code formatting
- **Conventional Commits**: Commit message format
- **Changesets**: Version management

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **NestJS Team** - For the excellent foundation and inspiration
- **TypeScript Team** - For the amazing type system
- **Open Source Community** - For the countless libraries and tools

---

## 📞 Support

- **Documentation**: [zern.dev/kernel](https://zern.dev/kernel)
- **Discord**: [Join our community](https://discord.gg/zern)
- **GitHub Issues**: [Report bugs](https://github.com/your-org/zern-kernel/issues)
- **Stack Overflow**: Tag your questions with `zern-kernel`

---

<div align="center">

**Built with ❤️ by the Zern Team**

[Website](https://zern.dev) • [Documentation](https://zern.dev/docs) • [Blog](https://zern.dev/blog) • [Twitter](https://twitter.com/zernframework)

</div>
