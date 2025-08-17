<h1 align="center">🔥 Zern Kernel</h1>
<h3 align="center">Strongly-Typed Plugin Kernel</h3>


> Ultra-lightweight plugin engine with natural DX and auto-extensibility

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Coverage](https://img.shields.io/endpoint?style=flat-square&url=https%3A%2F%2Fraw.githubusercontent.com%2Fzernjs%2Fzern-kernel%2Fmain%2Fcoverage%2Fcoverage-endpoint.json)](./coverage/coverage-summary.json)

</div>

<div align="center">

[![CI](https://github.com/zernjs/zern-kernel/actions/workflows/ci.yml/badge.svg?style=flat-square)](https://github.com/zernjs/zern-kernel/actions/workflows/ci.yml)
[![CodeQL](https://github.com/zernjs/zern-kernel/actions/workflows/codeql.yml/badge.svg?style=flat-square)](https://github.com/zernjs/zern-kernel/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/zernjs/zern-kernel?label=OpenSSF%20Scorecard&style=flat-square)](https://securityscorecards.dev/viewer/?uri=github.com/zernjs/zern-kernel)

</div>


## Overview

Zern Kernel is a next-generation plugin system designed for exceptional developer experience. It features a minimal core that allows plugins to be used naturally (like independent libraries), with automatic dependency resolution, transparent augmentations, and complete type safety.

## Key Features

- **🪶 Minimal Core**: Only essential functionality (register, init, augment)
- **🔄 Natural DX**: Import and use plugin functions directly
- **🤖 Auto Resolution**: Global kernel resolves automatically when needed
- **🔧 Transparent Augmentation**: Plugins can extend others invisibly
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
const DatabasePlugin = plugin('database', '1.0.0')
  .setup(() => ({
    async connect(url: string) {
      console.log(`Connected to: ${url}`);
      return { connected: true };
    },
    
    users: {
      async create(userData: any) {
        const id = Math.random().toString(36);
        console.log(`User created: ${id}`);
        return { id, ...userData };
      }
    }
  }));

// Create auth plugin with dependency
const AuthPlugin = plugin('auth', '1.0.0')
  .depends(DatabasePlugin)
  .setup(({ database }) => ({
    async validateToken(token: string) {
      // Use database dependency
      console.log(`Validating token: ${token}`);
      return token === 'valid-token';
    }
  }));

// Initialize kernel
const kernel = createKernel()
  .plugin(DatabasePlugin)
  .plugin(AuthPlugin)
  .build();

await kernel.init(); // Automatically becomes global

// Use plugins directly
const dbApi = kernel.getPlugin('database');
await dbApi.connect('postgresql://localhost:5432/mydb');

const user = await dbApi.users.create({ 
  name: 'John Doe', 
  email: 'john@example.com' 
});

const authApi = kernel.getPlugin('auth');
const isValid = await authApi.validateToken('valid-token');
```

### Natural Plugin Usage

Export functions from plugins for natural usage:

```typescript
// database-plugin/index.ts
import { getGlobalKernel } from '@zern/kernel';

export const DatabasePlugin = plugin('database', '1.0.0')
  .setup(() => ({ /* ... */ }));

// Export natural functions
export async function connect(url: string) {
  const kernel = getGlobalKernel();
  return kernel.getPlugin('database').connect(url);
}

export const users = {
  async create(userData: any) {
    const kernel = getGlobalKernel();
    return kernel.getPlugin('database').users.create(userData);
  }
};

// Usage in application
import { connect, users } from 'database-plugin';

await connect('postgresql://localhost:5432/mydb');
const user = await users.create({ name: 'John' });
```

## Plugin Augmentation

Plugins can extend other plugins transparently:

```typescript
// Plugin that augments database with preferences
const UserPreferencesPlugin = plugin('userPreferences', '1.0.0')
  .depends(DatabasePlugin)
  .augments('database', ({ database }) => ({
    users: {
      // Extends database.users with new method
      async findWithPreferences(id: string) {
        const user = await database.users.findById(id);
        const prefs = await database.query('SELECT * FROM preferences WHERE user_id = ?', [id]);
        return { ...user, preferences: prefs };
      }
    }
  }))
  .setup(() => ({}));

// After augmentation, the new method is available automatically
const userWithPrefs = await database.users.findWithPreferences('123');
```

## API Reference

### Core Functions

#### `createKernel()`
Creates a new kernel builder.

```typescript
const kernel = createKernel()
  .plugin(MyPlugin)
  .build();
```

#### `plugin(name, version)`
Creates a new plugin with fluent API.

```typescript
const MyPlugin = plugin('myPlugin', '1.0.0')
  .depends(OtherPlugin)
  .augments('target', ({ target }) => ({ newMethod: () => {} }))
  .setup(({ otherPlugin }) => ({
    myMethod: () => 'hello'
  }));
```

#### `getGlobalKernel()`
Returns the global kernel instance (set automatically by `kernel.init()`).

```typescript
const kernel = getGlobalKernel();
const api = kernel.getPlugin('myPlugin');
```

### Kernel Methods

#### `kernel.register(plugin)`
Registers a plugin with the kernel.

#### `kernel.init()`
Initializes all plugins and sets as global kernel automatically.

#### `kernel.getPlugin<T>(name)`
Gets a plugin API by name.

#### `kernel.destroy()`
Destroys all plugins and clears state.

## Advanced Features

### Intelligent Dependency Resolution

The kernel features a sophisticated dependency resolution system with:

#### Version Constraints
```typescript
const DatabasePlugin = plugin('database', '1.5.2')
  .setup(() => ({ connect, query, users }));

const AuthPlugin = plugin('auth', '3.1.0')
  .depends(DatabasePlugin, '^1.0.0') // Accepts any 1.x.x version
  .setup(({ database }) => ({ validateToken, createSession }));

const CachePlugin = plugin('cache', '2.0.1')
  .depends(DatabasePlugin, '>=1.5.0') // Needs 1.5.0 or higher
  .setup(({ database }) => ({ get, set }));
```

#### Load Order Control
```typescript
const kernel = createKernel()
  .plugin(DatabasePlugin)
  .plugin(CachePlugin) // Loads after Database (dependency)
  .plugin(MetricsPlugin, { 
    loadAfter: [DatabasePlugin], // Force load after Database
    loadBefore: [AuthPlugin]     // Force load before Auth
  })
  .plugin(AuthPlugin) // Loads after Database, Cache, and Metrics
  .build();

// Resolved order: Database → Cache → Metrics → Auth
```

#### Intelligent Conflict Detection
The system detects and provides helpful suggestions for:
- **Version conflicts**: Incompatible version constraints with upgrade suggestions
- **Missing dependencies**: Clear identification with registration instructions
- **Circular dependencies**: Complete cycle detection with resolution suggestions
- **Load order conflicts**: Contradictory constraints with specific recommendations

```typescript
// Example error messages:
// "Version conflict: Plugin 'auth' requires 'database' ^2.0.0, but found version 1.5.2. 
//  Suggestion: Upgrade DatabasePlugin to version 2.x.x or change auth dependency to '^1.0.0'"

// "Circular dependency detected: auth → cache → database → auth. 
//  Suggestion: Remove one of the dependencies or use loadAfter/loadBefore instead"
```

### Error Handling

The kernel provides clear error messages for common issues:

- Missing dependencies
- Circular dependencies  
- Duplicate plugin registration
- Accessing uninitialized kernel

### TypeScript Support

Full TypeScript support with autocomplete:

```typescript
// Plugins are fully typed
const api = kernel.getPlugin('database'); // Typed as DatabaseAPI
await api.connect(url); // Autocomplete available

// Dependencies are typed in setup
const MyPlugin = plugin('my', '1.0.0')
  .depends(DatabasePlugin)
  .setup(({ database }) => {
    // database is fully typed with autocomplete
    return { /* ... */ };
  });
```

## Examples

See the [examples](./examples) directory for complete usage examples:

- [Basic Usage](./examples/basic-usage.ts) - Simple plugin creation and usage
- More examples coming soon...

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## License

MIT © BiteCraft