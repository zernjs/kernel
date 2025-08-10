# Core Layer

The Core layer provides the primitives to assemble and run a type-safe plugin runtime:

- Kernel: orchestration (order resolution, lifecycle, integrations)
- Builder: composition and type accumulation
- Registry: plugin storage and load order hints
- Accessor: typed property and name-based access to plugins

---

## Architecture (at a glance)

```
createKernel() → KernelBuilder
  .use(PluginCtor, { before?, after? })  // collects type info
  .use(AnotherPlugin)
  .withOptions({...})                   // configure kernel (events adapters, etc.)
  .build() → Kernel

Kernel.init()
  ↳ resolve order (deps > user before/after > plugin hints)
  ↳ register hooks/events/errors/alerts declared by plugins
  ↳ validate plugin options (if provided) and pass to setup(ctx, options)
  ↳ start EventBus (releasing buffer/sticky)
  ↳ run lifecycle phases: beforeInit → init → afterInit
```

---

## Kernel

Responsible for bootstrapping and coordinating the runtime.

### Responsibilities

- Resolve plugin order (via Resolve layer)
- Register plugin-declared hooks/events/errors/alerts
- Start EventBus and route handler errors to ErrorBus
- Run lifecycle phases with policies (timeouts/retry)
- Provide typed access to plugin APIs via the Accessor

### API (summary)

- `init(): Promise<void>` — boot sequence
- `destroy(): Promise<void>` — shutdown phases (beforeDestroy → destroy → afterDestroy)
- `get(name: string)` — typed plugin getter
- `loadedPlugins: string[]` — names in load order
- `hooks`, `events`, `errors`, `alerts` — core buses

Options validation: during `init`, the Kernel will validate plugin options (if a plugin declares an options schema via `PluginOptionsSpec`) and pass the validated value to `setup(ctx, options)`.

### Example

```ts
import { createKernel } from '../core/createKernel';
import { definePlugin } from '../plugin/definePlugin';

const A = definePlugin({
  name: 'a',
  version: '1.0.0',
  async setup() {
    return { ping: () => 'pong' };
  },
});
const B = definePlugin({
  name: 'b',
  version: '1.0.0',
  async setup() {
    return {};
  },
});

const kernel = createKernel()
  .use(A)
  .use(B, { after: ['a'] })
  .build();
await kernel.init();

const a = kernel.get('a');
// @ts-expect-no-error
console.log(a?.ping());
```

---

## Builder

The builder gathers plugins, preserves their literal names for type accumulation, and creates a Kernel instance.

### API

- `use(PluginCtor, { before?, after? }) → KernelBuilder` (chainable)
- `build() → Kernel`

### Example

```ts
const builder = createKernel()
  .use(Database)
  .use(Utils, { after: ['database'] })
  .withOptions({
    events: {
      adapters: ['node'], // node é default se não fornecido
      // rxjs: { subjectFactory: (ns, ev) => new Subject() },
    },
  });

const kernel = builder.build();
```

---

## Registry

In-memory store for plugin instances and optional load order hints.

### API

- `register(plugin, order?)`
- `get(name) | has(name) | list()`
- `getLoadOrder(name)` — returns `{ before?: string[]; after?: string[] }` if provided
- `clear()` — reset registry (used by kernel on destroy)

---

## Accessor

A small Proxy-based accessor that exposes plugins as properties and via a typed getter.

### Why

- Convenient property access: `kernel.plugins.database?.connect()`
- Safe name-based access: `kernel.get('database')`

### Tip

Prefer `kernel.get(name)` inside libraries where property access may degrade tree-shaking.

---

## Options

Kernel options are minimal and focused on extension points:

```ts
interface KernelOptions {
  events?: {
    adapters?: Array<'node' | EventAdapter>; // Node EventEmitter is default unless disabled
    rxjs?: { subjectFactory: (ns: string, ev: string) => RxjsSubjectLike<unknown> };
  };
  augmentations?: { policy?: 'error' | 'override' | 'namespace'; namespacePrefix?: string };
}
```

Pass options via the builder: `createKernel().withOptions({...}).use(...).build()`.

---

## Init flow (detailed)

1. Collect user load preferences from the Registry (`before/after`)
2. Resolve order using the Resolve layer (deps > user order > hints). Errors are raised as `KernelError` codes
3. Register plugin-declared hooks/events/errors/alerts
4. Start EventBus (buffered/sticky emissions are released)
5. Run lifecycle phases: `beforeInit` → `init` → `afterInit`
6. Emit lifecycle notifications and update `loadedPlugins`

Handler exceptions in hooks/events are routed to `ErrorBus` with rich metadata for diagnostics.

---

## Error routing & observability

- Event handler failures: routed via `events.onError(...)` to `ErrorBus` (`source: 'event'`)
- Hook handler failures: routed by `HookBus` to `ErrorBus` (`source: 'hook'`)
- Lifecycle failures: wrapped as `KernelError('LifecyclePhaseFailed')` and emitted to `ErrorBus`
- You can subscribe to `ErrorBus` per namespace/kind to centralize reporting

---

## See also

- [Plugin](./plugin.md) — how to define plugins and expose APIs
- [Resolve](./resolve.md) — order & dependency resolution
- [Lifecycle](./lifecycle.md) — phases and policies
- [Events](./events.md) / [Hooks](./hooks.md) — communication primitives
- [Errors](./errors.md) / [Alerts](./alerts.md) — structured reporting
