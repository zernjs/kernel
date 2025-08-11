# Zern Kernel — Overview

Zern Kernel is a strongly-typed, extensible plugin runtime. It provides deterministic plugin loading, a robust lifecycle, first-class hooks and events, structured error/alert handling, and ergonomic augmentations — all optimized for excellent developer experience (DX).

## Key capabilities

- Deterministic load order via weighted constraints (Dependencies > User before/after > Plugin hints)
- Lifecycle engine with async phases and pluggable policies (timeouts/retry)
- Hooks and Events with namespaces, delivery/startup modes, middlewares, and adapters
- Structured ErrorBus and AlertBus with policies/channels and error routing from hooks/events
- Augmentations (declarative `augments` or programmatic `ctx.extend`) to safely extend other plugins
- Strong typing end-to-end: autocomplete for plugin APIs, hooks, events, errors, and alerts

## How it fits

The kernel focuses on the foundation only — composition, lifecycle, ordering, and typed communication primitives. Anything “higher level” (framework features, heavy operators/policies/adapters) can live as plugins on top of this core.

## Quick Start

Use the consolidated entrypoint `@zern/kernel` instead of per-file imports. The root exposes all layers and DX helpers that initialize the Kernel automatically when needed.

```ts
import { plugin, events, errors, getKernel, useEvents, emitEvent } from '@zern/kernel';

const Auth = plugin.definePlugin({
  name: 'auth',
  version: '1.0.0',
  events: events.createEvents('auth', { login: events.event() }),
  errors: errors.defineErrors('auth', { InvalidCredentials: (p: { reason: string }) => p }).spec,
  async setup({ kernel }) {
    await kernel.events.namespace('auth').emit('login', { userId: 'u1' });
    return {};
  },
});

const kernel = getKernel().use(Auth).build();
await kernel.init();

// DX helpers
const ev = await useEvents();
await ev.namespace('auth').emit('login', { userId: 'u2' });
await emitEvent('auth', 'login', { userId: 'u3' });
```

See the package `README.md` for a concise Quick Start and minimal API reference. Then deep-dive into the docs below to learn each layer.

## Documentation map

- Core: builder, kernel, registry, accessors — `./core.md`
- Plugin: `definePlugin`, metadata, setup(ctx), augmentations — `./plugin.md`
- Resolve: constraint graph, stable topological sort, order resolver — `./resolve.md`
- Lifecycle: phases, engine, policies, lifecycle events — `./lifecycle.md`
- Hooks: `hook`, HookBus, error routing — `./hooks.md`
- Events: namespaces, delivery/startup modes, middlewares, adapters — `./events.md`
- Errors: ErrorBus, kernel error types, policies, helpers — `./errors.md`
- Alerts: AlertBus, channels, helpers — `./alerts.md`
- Diagnostics: logger, metrics, debug — `./diagnostics.md`
- Types: public type exports — `./types.md`
- Utils: semver, guards, timing, concurrency, result — `./utils.md`

## Design principles

- Keep the core small, stable, and strongly-typed
- Favor composition and plugins for advanced capabilities
- Predictability over magic; explicit order and lifecycle
- DX-first: sensible defaults, minimal boilerplate, great autocomplete

## Next steps

1. Read the Quick Start in `README.md`
2. Explore Core and Plugin docs
3. Add Hooks/Events/Errors/Alerts as needed
4. Use augmentations to evolve APIs safely
