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
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fzernjs%2Fzern-kernel%2Fmain%2Fcoverage%2Fcoverage-endpoint.json&style=for-the-badge)](./coverage/coverage-summary.json)

</div>

<div align="center">

[![CI](https://github.com/zern/zern-kernel/actions/workflows/ci.yml/badge.svg)](https://github.com/zern/zern-kernel/actions/workflows/ci.yml)
[![CodeQL](https://github.com/zern/zern-kernel/actions/workflows/codeql.yml/badge.svg)](https://github.com/zern/zern-kernel/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/zern/zern-kernel?label=OpenSSF%20Scorecard)](https://github.com/ossf/scorecard)

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
import { plugin, events, errors, getKernel } from '@zern/kernel';

const Database = plugin.definePlugin({
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

const kernel = getKernel().use(Database).use(Auth).build();

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

## 📦 Packages

- `packages/ts-ls`: TypeScript Language Service plugin that serves virtual type augmentations for Zern Kernel during development. See `packages/ts-ls/README.md`.

---

## 🔧 Minimal API Reference

- Kernel
  - `getKernel() → KernelBuilder` (auto-bootstrapped root builder)
  - `ensureKernel() → Promise<Kernel>` (build+init once, reuse later)
  - `withKernel(select) → Promise<T>` (ensure + project value)
  - `builder.use(Plugin, { before?, after?, options? }) → KernelBuilder`
  - `builder.build() → Kernel`
  - `kernel.init()/destroy()`
  - `kernel.get(name)`
- Plugin
  - `plugin.definePlugin({ name, version, dependsOn?, hooks?, events?, errors?, alerts?, augments?, setup(ctx) { return API } })`
  - `ctx.extend(target, api)` to programmatically augment other plugins
- Hooks
  - `useHooks() → Promise<Kernel['hooks']>`
  - `kernel.hooks.define(name).on/emit/once`
- Events
  - `useEvents() → Promise<Kernel['events']>`
  - `emitEvent(ns, name, payload)` convenience
  - `kernel.events.namespace(ns).define(event, opts).on/emit/once`
  - Delivery: `sync|microtask|async`; Startup: `drop|buffer|sticky`
  - Middlewares: global/namespace/event-level `use(mw)`
- Errors/Alerts
  - `useErrors()/useAlerts()`; `ErrorBus`/`AlertBus` with `.on/.off/.emit`

> Power users can still import advanced pieces directly via namespaces:
> `import { core, plugin, events, errors } from '@zern/kernel'`.

For full details, see the docs in `./docs/`.

---

## Security & Quality Gates

- Tests and coverage: see CI artifacts.
- Static analysis: CodeQL (no critical findings).
- OpenSSF Scorecard: automated checks.
- Supply chain: SBOM (CycloneDX), lockfile, Dependabot.
- Benchmarks: lifecycle and throughput workloads (tools/benchmarks).

## 📄 License

MIT
