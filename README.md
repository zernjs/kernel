<div align="center">

# 🔥 Zern Kernel

## Strongly-Typed Plugin Kerne

</div>

> Ultra-lightweight plugin engine with natural DX and auto-extensibility

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/) [![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT) [![Coverage](https://img.shields.io/endpoint?style=flat-square&url=https%3A%2F%2Fraw.githubusercontent.com%2Fzernjs%2Fzern-kernel%2Fmain%2Fcoverage%2Fcoverage-endpoint.json)](./coverage/coverage-summary.json)

</div>

<div align="center">

[![CI](https://github.com/zernjs/zern-kernel/actions/workflows/ci.yml/badge.svg?style=flat-square)](https://github.com/zernjs/zern-kernel/actions/workflows/ci.yml) [![CodeQL](https://github.com/zernjs/zern-kernel/actions/workflows/codeql.yml/badge.svg?style=flat-square)](https://github.com/zernjs/zern-kernel/actions/workflows/codeql.yml) [![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/zernjs/zern-kernel?label=OpenSSF%20Scorecard&style=flat-square)](https://securityscorecards.dev/viewer/?uri=github.com/zernjs/zern-kernel)

</div>

## Overview

Zern Kernel is a next-generation plugin system designed for exceptional developer experience. It features a minimal core that allows plugins to be used naturally (like independent libraries), with automatic dependency resolution, transparent augmentations, and complete type safety.

## Key Features

- **🪶 Minimal Core**: Only essential functionality (register, init, shutdown)
- **🔄 Natural DX**: Access plugin APIs through type-safe kernel.get()
- **🤖 Auto Resolution**: Automatic dependency resolution and lifecycle management
- **🔧 Transparent Extensions**: Plugins can extend others with seamless API merging
- **📝 Zero Boilerplate**: Fluent API eliminates ceremonial code
- **🛡️ Complete Type Safety**: Full TypeScript support with autocomplete

## Quick Start

### Installation

```bash
npm install @zern/kernel
```

### Basic Usage

```typescript
import { createKernel, plugin } from '@zern/kernel';

// Create a database plugin
const DatabasePlugin = plugin('database', '1.0.0').setup(() => ({
  async connect(url: string) {
    console.log(`Connected to: ${url}`);
    return { connected: true };
  },

  users: {
    async create(userData: any) {
      const id = Math.random().toString(36);
      console.log(`User created: ${id}`);
      return { id, ...userData };
    },
  },
}));

// Create auth plugin with dependency
const AuthPlugin = plugin('auth', '1.0.0')
  .depends(DatabasePlugin)
  .setup(({ plugins }) => ({
    async validateToken(token: string) {
      // Use database dependency
      console.log(`Validating token: ${token}`);
      return token === 'valid-token';
    },
  }));

// Initialize kernel
const kernel = await createKernel().use(DatabasePlugin).use(AuthPlugin).start();

// Use plugins directly
const dbApi = kernel.get('database');
await dbApi.connect('postgresql://localhost:5432/mydb');

const user = await dbApi.users.create({
  name: 'John Doe',
  email: 'john@example.com',
});

const authApi = kernel.get('auth');
const isValid = await authApi.validateToken('valid-token');
```

### Plugin Extensions

Plugins can extend other plugins transparently:

```typescript
// Plugin that extends database with preferences
const UserPreferencesPlugin = plugin('userPreferences', '1.0.0')
  .depends(DatabasePlugin)
  .extend(DatabasePlugin, database => ({
    users: {
      // Extends database.users with new method
      async findWithPreferences(id: string) {
        const user = await database.users.findById(id);
        const prefs = await database.query('SELECT * FROM preferences WHERE user_id = ?', [id]);
        return { ...user, preferences: prefs };
      },
    },
  }))
  .setup(() => ({}));

// After kernel initialization, the extended method is available
const db = kernel.get('database');
const userWithPrefs = await db.users.findWithPreferences('123');
```

## API Reference

### Core Functions

#### `createKernel()`

Creates a new kernel builder.

```typescript
const kernel = await createKernel().use(MyPlugin).withConfig({ logLevel: 'debug' }).start();
```

#### `plugin(name, version)`

Creates a new plugin with fluent API.

```typescript
const MyPlugin = plugin('myPlugin', '1.0.0')
  .depends(OtherPlugin)
  .extend(TargetPlugin, api => ({ newMethod: () => {} }))
  .setup(({ plugins }) => ({
    myMethod: () => 'hello',
  }));
```

### Kernel Builder Methods

#### `use(plugin)`

Registers a plugin with the kernel.

```typescript
const kernel = createKernel().use(DatabasePlugin).use(AuthPlugin);
```

#### `withConfig(config)`

Sets kernel configuration options.

```typescript
const kernel = createKernel().withConfig({
  logLevel: 'debug',
  strictVersioning: true,
  initializationTimeout: 30000,
});
```

#### `build()`

Builds the kernel without initializing it.

```typescript
const builtKernel = createKernel().use(MyPlugin).build();

const kernel = await builtKernel.init();
```

#### `start()`

Builds and initializes the kernel in one step.

```typescript
const kernel = await createKernel().use(MyPlugin).start();
```

### Kernel Methods

#### `kernel.get<T>(name)`

Gets a plugin API by name with full type safety.

```typescript
const api = kernel.get('myPlugin'); // Fully typed
```

#### `kernel.shutdown()`

Shuts down all plugins and clears state.

```typescript
await kernel.shutdown();
```

### Plugin Builder Methods

#### `depends(plugin, versionRange?)`

Declares a dependency on another plugin.

```typescript
const MyPlugin = plugin('my', '1.0.0')
  .depends(DatabasePlugin, '^1.0.0')
  .setup(({ plugins }) => {
    // plugins.database is available and typed
  });
```

#### `extend(target, extensionFn)`

Extends another plugin's API.

```typescript
const ExtenderPlugin = plugin('extender', '1.0.0')
  .extend(TargetPlugin, api => ({
    newMethod: () => api.existingMethod() + ' extended',
  }))
  .setup(() => ({}));
```

#### `setup(setupFn)`

Defines the plugin's implementation.

```typescript
const MyPlugin = plugin('my', '1.0.0').setup(({ plugins, kernel }) => ({
  doSomething: () => 'result',
}));
```

## Advanced Features

### Intelligent Dependency Resolution

The kernel features a sophisticated dependency resolution system with:

#### Version Constraints

```typescript
const DatabasePlugin = plugin('database', '1.5.2').setup(() => ({ connect, query, users }));

const AuthPlugin = plugin('auth', '3.1.0')
  .depends(DatabasePlugin, '^1.0.0') // Accepts any 1.x.x version
  .setup(({ plugins }) => ({ validateToken, createSession }));

const CachePlugin = plugin('cache', '2.0.1')
  .depends(DatabasePlugin, '>=1.5.0') // Needs 1.5.0 or higher
  .setup(({ plugins }) => ({ get, set }));
```

#### Intelligent Error Detection

The system detects and provides helpful suggestions for:

- **Version conflicts**: Incompatible version constraints with upgrade suggestions
- **Missing dependencies**: Clear identification with registration instructions
- **Circular dependencies**: Complete cycle detection with resolution suggestions

```typescript
// Example error messages:
// "Version conflict: Plugin 'auth' requires 'database' ^2.0.0, but found version 1.5.2.
//  Suggestion: Upgrade DatabasePlugin to version 2.x.x or change auth dependency to '^1.0.0'"

// "Circular dependency detected: auth → cache → database → auth.
//  Suggestion: Remove one of the dependencies or restructure plugin relationships"
```

### Configuration Options

```typescript
interface KernelConfig {
  autoGlobal: boolean; // Auto-register as global kernel
  strictVersioning: boolean; // Enforce strict version matching
  circularDependencies: boolean; // Allow circular dependencies
  initializationTimeout: number; // Timeout in milliseconds
  extensionsEnabled: boolean; // Enable plugin extensions
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
```

### TypeScript Support

Full TypeScript support with autocomplete:

```typescript
// Plugins are fully typed
const api = kernel.get('database'); // Typed as DatabaseAPI
await api.connect(url); // Autocomplete available

// Dependencies are typed in setup
const MyPlugin = plugin('my', '1.0.0')
  .depends(DatabasePlugin)
  .setup(({ plugins }) => {
    // plugins.database is fully typed with autocomplete
    return {
      /* ... */
    };
  });
```

## Examples

See the [examples](./examples) directory for complete usage examples:

- [Basic Usage](./examples/basic-usage.ts) - Plugin creation, dependencies, and extensions
- More examples coming soon...

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT © BiteCraft
