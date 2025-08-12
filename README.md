<h1 align="center">🔥 Zern Kernel</h1>
<h3 align="center">Strongly-Typed Plugin Kernel</h3>

<div align="center">

Type-safe plugin runtime with deterministic load order, lifecycle, typed errors with autocomplete, and ergonomic augmentations.

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

**The pure plugin engine powering the ZernJS Framework**

[Documentation](./docs/overview.md) • [API Reference](./docs/overview.md#api-reference) • [Layers](#-layers) • [Examples](#-quick-start)

</div>

---

## ✨ Highlights

- 🔌 Plugin architecture with first-class DX (`definePlugin`, `createKernel`)
- ✅ Strong typing and autocomplete across plugins and typed errors
- 🧭 Deterministic plugin order (Deps > User before/after > Hints) with topological sort
- 🔁 Lifecycle engine with phases and policies (timeouts/retry)
- 🧰 Typed ErrorBus with factories and helpers `report`/`fail`/`once`/`on`
- 🧩 Augmentations: declarative (`augments`) and `ctx.extend()` with conflict policies

---

## 🚀 Quick Start (Typed Errors)

```ts
import { core, plugin, errors as Err, report, fail, once, on } from '@zern/kernel';

const AuthErrors = Err.defineErrors('auth', {
  InvalidCredentials: (p: { user: string }) => p,
  LockedAccount: (p: { user: string }) => p,
});

const Auth = plugin.definePlugin({
  name: 'auth',
  version: '1.0.0',
  errors: AuthErrors,
  async setup() {
    return {
      async login(user: string, pass: string) {
        if (user !== 'u1' || pass !== 'secret') {
          await report('auth.InvalidCredentials', { user });
          return false;
        }
        return true;
      },
    };
  },
});

const kernel = core.createKernel().use(Auth).build();
await kernel.init();

await report('auth.InvalidCredentials', { user: 'u2' });
try {
  await fail('auth.LockedAccount', { user: 'u3' });
} catch {}
const payload = await once('auth.InvalidCredentials');
await on('auth.InvalidCredentials', p => console.log(p.user));
```

### Bound helpers with `createErrorHelpers`

```ts
import { core, plugin, errors as Err, createErrorHelpers } from '@zern/kernel';

const AuthErrors = Err.defineErrors('auth', {
  InvalidCredentials: (p: { user: string }) => p,
  LockedAccount: (p: { user: string }) => p,
});

const Auth = plugin.definePlugin({
  name: 'auth',
  version: '1.0.0',
  errors: AuthErrors,
  async setup() {
    return {};
  },
});

const kernel = core.createKernel().use(Auth).build();
await kernel.init();

// Prefer bound helpers for best DX (autocomplete and inferred payloads)
const { on, report, once, fail } = createErrorHelpers(kernel);

const off = await on('auth.InvalidCredentials', payload => {
  console.log('invalid:', payload.user);
});

await report('auth.InvalidCredentials', { user: 'u1' });
const payload = await once('auth.InvalidCredentials');
try {
  await fail('auth.LockedAccount', { user: 'u3' });
} catch {}
off();
```

---

## 🧩 Layers

> Deep-dive docs for each layer live under `docs/`.

- [Core](./docs/core.md): builder, kernel, registry, accessors
- [Plugin](./docs/plugin.md): `definePlugin`, options, metadata, augmentations
- [Resolve](./docs/resolve.md): constraint graph, topological sort, order resolver
- [Lifecycle](./docs/lifecycle.md): phases, engine, policies
- [Errors](./docs/errors.md): `ErrorBus`, kernel error types, policies, helpers
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
  - `getKernel() → KernelBuilder`
  - `ensureKernel() → Promise<Kernel>`
  - `withKernel(select) → Promise<T>`
  - `builder.use(Plugin, { before?, after? }) → KernelBuilder`
  - `builder.build() → Kernel`
  - `kernel.init()/destroy()`
  - `kernel.plugins.<name>` (typed access to plugins)
- Plugin
  - `plugin.definePlugin({ name, version, dependsOn?, errors?, augments?, setup(ctx) { return API } })`
  - `ctx.extend(target, api)` to safely extend other plugins
- Errors
  - `errors.defineErrors(ns, spec)` → `{ spec, factories }`
  - Kernel.errors: `.on(factory, handler)`, `.report(token, meta?)`, `.fail(token, meta?)`
  - Global helpers: `report`, `fail`, `once`, `on` with keys `'ns.kind'`
  - Bound helpers: `createErrorHelpers(kernel)` for autocomplete and inferred payloads

For full details, see the docs in `./docs/`.

---

## Security & Quality Gates

- Tests and coverage in CI; coverage badge published.
- Static analysis: CodeQL workflow.
- OpenSSF Scorecard workflow.
- Supply chain: SBOM (CycloneDX) with Syft; lockfile and Dependabot.
- Benchmarks: lifecycle and throughput (`tools/benchmarks/`).

Generate a local SBOM:

```bash
pnpm sbom
# or via Docker
pnpm sbom:docker
```

## 📄 License

MIT
