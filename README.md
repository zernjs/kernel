<h1 align="center">
🔥 Zern Kernel
</h1>

<h3 align="center">
Strongly-Typed Plugin Kernel
</h3>

<div align="center">

Type-safe plugin runtime with deterministic load order, lifecycle, hooks, events, errors, alerts, and ergonomic augmentations.

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/zernjs/zern-kernel/ci.yml?style=for-the-badge)](https://github.com/zernjs/zern-kernel/actions)
[![Coverage](https://img.shields.io/badge/coverage-59%25-red?style=for-the-badge)](./packages/kernel/coverage/README.md)

</div>

**The pure plugin engine powering the ZernJS Framework**

[Documentation](./docs/overview.md) • [API Reference](./docs/overview.md#api-reference) • [Layers](#-layers) • [Examples](#-quick-start)

</div>

---

## ✨ Highlights

- 🔌 Plugin architecture with first-class DX (`definePlugin`, `createKernel`)
- ✅ Strong typing and autocomplete across plugins, hooks, events, errors, alerts
- 🧭 Deterministic plugin order (Deps > User before/after > Hints) with topological sort
- 🔁 Lifecycle engine with phases and policies (timeouts/retry)
- 🪝 Hooks system and 📡 Event bus (namespaces, delivery/startup modes, middlewares)
- 🧰 ErrorBus and AlertBus with pluggable policies/channels
- 🧩 Augmentations: declarative or `ctx.extend()` to safely extend other plugins

---

## 🚀 Quick Start

```ts
import { createKernel } from './src/core/createKernel';
import { definePlugin } from './src/plugin/definePlugin';
import { createEvents, event } from './src/events/event-bus';
import { createErrors, defineError } from './src/errors/error-bus';

const Database = definePlugin({
  name: 'database',
  version: '1.0.0',
  async setup() {
    let connected = false;
    return {
      async connect(cs: string) {
        connected = true;
      },
      isConnected() {
        return connected;
      },
    };
  },
});

const Auth = definePlugin({
  name: 'auth',
  version: '1.0.0',
  events: createEvents('auth', { login: event() }),
  errors: createErrors('auth', { InvalidCredentials: defineError() }),
  async setup({ kernel }) {
    await kernel.events.namespace('auth').emit('login', { userId: 'u1' });
    return {};
  },
});

const kernel = createKernel().use(Database).use(Auth).build();

await kernel.init();
```

---

## 🧩 Layers

> Deep-dive docs for each layer live under `docs/`.

- [Core](./docs/core.md): builder, kernel, registry, accessors
- [Plugin](./docs/plugin.md): `definePlugin`, options, metadata, augmentations
- [Resolve](./docs/resolve.md): constraint graph, topological sort, order resolver
- [Lifecycle](./docs/lifecycle.md): phases, engine, policies, events
- [Hooks](./docs/hooks.md): hook API, bus, error routing
- [Events](./docs/events.md): namespaces, delivery/startup modes, middlewares, adapters
- [Errors](./docs/errors.md): `ErrorBus`, kernel error types, policies
- [Alerts](./docs/alerts.md): `AlertBus`, channels
- [Diagnostics](./docs/diagnostics.md): logger, metrics, debug
- [Types](./docs/types.md): shared types and public exports
- [Utils](./docs/utils.md): semver, guards, timing, concurrency, result

---

## 🧪 Testing

- Unit tests colocated near source files
- Integration and e2e in `packages/kernel/tests/`

Run all tests from the repo root or package:

```sh
pnpm -w test --filter @zern/kernel
```

---

## 🔧 Minimal API Reference

- Kernel
  - `createKernel() → KernelBuilder`
  - `builder.use(Plugin, { before?, after?, options? }) → KernelBuilder`
  - `builder.build() → Kernel`
  - `kernel.init()/destroy()`
  - `kernel.get(name)`
- Plugin
  - `definePlugin({ name, version, dependsOn?, hooks?, events?, errors?, alerts?, augments?, setup(ctx) { return API } })`
  - `ctx.extend(target, api)` to programmatically augment other plugins
- Hooks
  - `kernel.hooks.define(name).on/emit/once`
- Events
  - `kernel.events.namespace(ns).define(event, opts).on/emit/once`
  - Delivery: `sync|microtask|async`; Startup: `drop|buffer|sticky`
  - Middlewares: global/namespace/event-level `use(mw)`
- Errors/Alerts
  - `ErrorBus`/`AlertBus` with `.on/.off/.emit`, plus `bindErrors/bindAlerts` helpers

For full details, see the docs in `./docs/`.

---

## 📄 License

MIT
