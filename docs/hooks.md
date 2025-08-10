# Hooks Layer

The Hooks layer provides a lightweight, type-friendly publish/subscribe mechanism for intra- and inter-plugin notifications. Hooks are synchronous in shape (return void/Promise<void>) and designed for small, focused signals.

## Concepts

- Hook: a channel for a specific payload type, with `on/off/emit/once`
- HookBus: registry that defines and retrieves hooks by name
- Namespacing: recommended to prefix hooks with the plugin name, e.g., `auth.onLogin`
- Error routing: handler exceptions are forwarded to `ErrorBus` for observability

## API Surface

See `src/hooks/hook.ts` and `src/hooks/hook-bus.ts`.

- `hook<Payload>() → Hook<Payload>`
  - `on(handler) → () => void`
  - `off(handler) → void`
  - `emit(payload) → Promise<void>`
  - `once() → Promise<Payload>`
- `HookBus`
  - `define<Payload>(name) → Hook<Payload>`
  - `get<Payload>(name) → Hook<Payload> | undefined`
  - Internally can route handler errors to `ErrorBus` with metadata `{ source: 'hook', eventName: name }`

## Basic Usage

```ts
const onLogin = kernel.hooks.define<{ userId: string }>('auth.onLogin');

const off = onLogin.on(({ userId }) => {
  // handle login
});

await onLogin.emit({ userId: 'u1' });
off();
```

### Namespaced access

You can use a naming convention to group hooks per plugin: `pluginName.hookName`.

```ts
kernel.hooks.define('payments.onCaptured');
kernel.hooks.define('payments.onRefunded');
```

## Error routing

Hook handler exceptions are caught and forwarded to `ErrorBus` with metadata:

- Namespace: `hooks`
- Kind: `HandlerError`
- Metadata: `{ source: 'hook', eventName }`

Subscribe via:

```ts
kernel.errors.on('hooks', 'HandlerError', (err, meta) => {
  /* log/report */
});
```

## Plugin-declared hooks

Plugins can declare a set of hooks in `definePlugin`; the Kernel will define them during init.

```ts
import { definePlugin } from '../plugin/definePlugin';

const Auth = definePlugin({
  name: 'auth',
  version: '1.0.0',
  hooks: {
    onLogin: {} as unknown as { on: unknown; off: unknown; emit: unknown; once: unknown },
  },
  async setup({ kernel }) {
    // later in setup or runtime
    await kernel.hooks.get<{ userId: string }>('auth.onLogin')?.emit({ userId: 'u1' });
    return {};
  },
});
```

## Recommendations

- Keep hooks small and frequent; use Events if you need buffering/sticky or delivery modes
- Prefer clear names (plugin.feature.action) to avoid collisions
- Ensure handlers are robust; errors are routed to ErrorBus but should be minimized
