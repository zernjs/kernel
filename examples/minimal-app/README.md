# Minimal App Boilerplate

> Simple, clean, and ready-to-use Zern Kernel application structure

## 📁 Structure

```
minimal-app/
├── src/
│   ├── index.ts          # Application entry point
│   ├── config.ts         # Configuration management
│   └── plugins/          # Plugin definitions
│       ├── index.ts      # Barrel export
│       ├── logger.ts     # Logger plugin
│       └── database.ts   # Database plugin
├── package.json          # Dependencies
└── README.md            # This file
```

## 🚀 Features

- ✅ Simple folder structure
- ✅ Easy configuration management
- ✅ Plugin organization
- ✅ Type-safe throughout
- ✅ Ready for production

## 📦 Installation

```bash
# Copy this folder to your project
cp -r examples/minimal-app my-app
cd my-app

# Install dependencies
pnpm install
```

## 🎯 Usage

```bash
# Run the application
pnpm start

# Build for production
pnpm build

# Run built version
node dist/index.js
```

## 🔧 Configuration

Edit `src/config.ts` to customize:

```typescript
export const config = {
  app: {
    name: 'My App',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/mydb',
  },
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
```

## 📝 Adding New Plugins

1. Create a new file in `src/plugins/`:

```typescript
// src/plugins/cache.ts
import { plugin } from '@zern/kernel';
import { config } from '../config';

export const cachePlugin = plugin('cache', '1.0.0').setup(() => ({
  get: (key: string) => {
    /* ... */
  },
  set: (key: string, value: unknown) => {
    /* ... */
  },
}));
```

2. Export it in `src/plugins/index.ts`:

```typescript
export * from './cache';
```

3. Register it in `src/index.ts`:

```typescript
const kernel = await createKernel()
  .use(loggerPlugin)
  .use(databasePlugin)
  .use(cachePlugin) // Add here
  .start();
```

## 🎨 Customization

### Adding Environment Variables

Create a `.env` file:

```env
NODE_ENV=production
DATABASE_URL=postgresql://localhost:5432/mydb
LOG_LEVEL=debug
```

### Using Different Plugins

Replace or extend the existing plugins based on your needs:

```typescript
// src/plugins/api.ts
export const apiPlugin = plugin('api', '1.0.0')
  .depends(databasePlugin, '^1.0.0')
  .setup(({ plugins }) => ({
    getUsers: async () => plugins.database.query('SELECT * FROM users'),
  }));
```

## 📚 Learn More

- [Zern Kernel Documentation](../../docs/README.md)
- [Plugin System](../../docs/03-plugin-system.md)
- [Best Practices](../../docs/10-best-practices.md)

---

**Happy coding!** 🚀
