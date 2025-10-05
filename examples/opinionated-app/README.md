# Opinionated App Boilerplate

> Production-ready, scalable Zern Kernel application with best practices

## 📁 Structure

```
opinionated-app/
├── src/
│   ├── index.ts              # Application entry point
│   ├── app.ts                # Application class
│   ├── config/               # Configuration layer
│   │   ├── index.ts          # Barrel export
│   │   ├── app.config.ts     # App configuration
│   │   ├── database.config.ts # Database configuration
│   │   └── env.ts            # Environment validation
│   ├── plugins/              # Plugin layer
│   │   ├── index.ts          # Barrel export
│   │   ├── core/             # Core plugins
│   │   │   ├── logger.plugin.ts
│   │   │   └── database.plugin.ts
│   │   └── features/         # Feature plugins
│   │       ├── users.plugin.ts
│   │       └── monitoring.plugin.ts
│   ├── services/             # Business logic layer
│   │   ├── index.ts          # Barrel export
│   │   └── user.service.ts   # User service
│   ├── types/                # Type definitions
│   │   ├── index.ts          # Barrel export
│   │   ├── user.types.ts     # User types
│   │   └── common.types.ts   # Common types
│   └── utils/                # Utility functions
│       ├── index.ts          # Barrel export
│       └── formatters.ts     # Data formatters
├── package.json              # Dependencies
└── README.md                # This file
```

## 🌟 Features

- ✅ **Layered Architecture** - Clear separation of concerns
- ✅ **Environment Validation** - Type-safe environment variables
- ✅ **Plugin Organization** - Core vs Features separation
- ✅ **Service Layer** - Business logic abstraction
- ✅ **Global Proxies** - Logging, timing, error handling
- ✅ **Lifecycle Management** - Proper initialization and shutdown
- ✅ **Type Safety** - Full TypeScript support
- ✅ **Production Ready** - Best practices built-in

## 🚀 Quick Start

```bash
# Copy this folder to your project
cp -r examples/opinionated-app my-app
cd my-app

# Install dependencies
pnpm install

# Create .env file (see example below)
cp .env.example .env

# Run the application
pnpm start
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
# Application
NODE_ENV=development
APP_NAME=My App
APP_VERSION=1.0.0

# Database
DATABASE_URL=postgresql://localhost:5432/mydb
DB_MAX_CONNECTIONS=10
DB_TIMEOUT=5000

# Logger
LOG_LEVEL=info

# Monitoring
ENABLE_MONITORING=true
MONITORING_INTERVAL=10000
```

### Configuration Files

- `config/app.config.ts` - Application settings
- `config/database.config.ts` - Database configuration
- `config/env.ts` - Environment validation

## 📦 Architecture Layers

### 1. **Config Layer**

Centralized configuration management with environment validation.

### 2. **Plugin Layer**

- **Core Plugins**: Essential functionality (logger, database)
- **Feature Plugins**: Business features (users, monitoring)

### 3. **Service Layer**

Business logic abstraction, used by plugins.

### 4. **Utils Layer**

Shared utility functions and helpers.

## 🎯 Adding New Features

### 1. Create a Type

```typescript
// src/types/product.types.ts
export interface Product {
  id: string;
  name: string;
  price: number;
}
```

### 2. Create a Service

```typescript
// src/services/product.service.ts
export class ProductService {
  async create(data: CreateProductDTO): Promise<Product> {
    // Business logic here
  }
}
```

### 3. Create a Plugin

```typescript
// src/plugins/features/products.plugin.ts
export const productsPlugin = plugin('products', '1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .setup(({ plugins }) => {
    const service = new ProductService(plugins.database);
    return {
      create: data => service.create(data),
      findById: id => service.findById(id),
    };
  });
```

### 4. Register in Kernel

```typescript
// src/app.ts
import { productsPlugin } from './plugins/features/products.plugin';

// Add to kernel
.use(productsPlugin)
```

## 🎭 Proxy System

This boilerplate demonstrates all proxy capabilities:

### Global Logging Proxy

Logs all plugin method calls automatically.

### Global Timing Proxy

Measures execution time for all methods.

### Global Error Handling Proxy

Catches and logs errors consistently.

## 🔄 Lifecycle Hooks

Plugins use lifecycle hooks for proper resource management:

- **`onInit`** - Initialize resources
- **`onReady`** - Confirm readiness
- **`onShutdown`** - Cleanup resources
- **`onError`** - Handle errors

## 📊 Monitoring

Built-in monitoring plugin tracks:

- Plugin health status
- Method call counts
- Error rates
- Performance metrics

## 🧪 Testing

```typescript
import { createKernel } from '@zern/kernel';
import { loggerPlugin, databasePlugin } from './plugins';

describe('Application', () => {
  let kernel: Kernel<any>;

  beforeEach(async () => {
    kernel = await createKernel().use(loggerPlugin).use(databasePlugin).start();
  });

  afterEach(async () => {
    await kernel.shutdown();
  });

  it('should create user', async () => {
    const users = kernel.get('users');
    const user = await users.create({ name: 'Test', email: 'test@example.com' });
    expect(user).toHaveProperty('id');
  });
});
```

## 📝 Best Practices

1. **Keep plugins focused** - One responsibility per plugin
2. **Use services for business logic** - Plugins should be thin wrappers
3. **Validate configuration** - Use environment validation
4. **Handle errors properly** - Use global error proxy or custom handlers
5. **Clean up resources** - Always use lifecycle hooks
6. **Type everything** - Leverage TypeScript fully

## 📚 Learn More

- [Zern Kernel Documentation](../../docs/README.md)
- [Architecture Overview](../../docs/01-architecture-overview.md)
- [Best Practices](../../docs/10-best-practices.md)
- [Proxy System](../../docs/12-proxy-system.md)

---

**Built with ❤️ using Zern Kernel** 🚀
