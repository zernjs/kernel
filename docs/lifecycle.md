# Lifecycle Layer

The Lifecycle layer coordinates plugin phases and provides hooks, policies, and events for observability and resilience.

## Phases

Core phases executed by the Kernel:

- `beforeInit` → `init` → `afterInit`
- `beforeDestroy` → `destroy` → `afterDestroy`

Each phase is optional. If a plugin does not implement a phase, it is skipped.

## Engine

Implemented in `src/lifecycle/lifecycle-engine.ts` as `LifecycleEngine`.

### Behavior

- Executes phases for each plugin in the resolved order
- Calls a plugin function if it exists (by phase name)
- Wraps execution with policies (timeouts/retry) via `runWithPolicy`
- Errors thrown within a phase are wrapped as `KernelError('LifecyclePhaseFailed')`

### API

```ts
class LifecycleEngine {
  constructor(opts?: { concurrency?: number; policies?: LifecyclePolicies }) {}
  runPhase(phase: LifecyclePhase, plugins: PluginInstance[], kernel: unknown): Promise<void>;
}
```

> Note: `concurrency` is reserved for future parallelization across topological levels. The default behavior is sequential per order.

## Policies

Policies live in `src/lifecycle/lifecycle-policies.ts` and currently include timeout/retry primitives via `runWithPolicy`.

Example policy configuration pattern:

```ts
const lifecycle = new LifecycleEngine({
  policies: {
    init: { timeoutMs: 10_000 },
    destroy: { timeoutMs: 10_000 },
  },
});
```

## Lifecycle Events

`src/lifecycle/lifecycle-events.ts` provides a small emitter for lifecycle notifications.

- `pluginLoaded` — emitted after a plugin finishes init
- `pluginFailed` — emitted when a plugin (or lifecycle) fails, with an error payload

Subscribe via:

```ts
kernel.lifecycleEvents.on('pluginLoaded', e => {
  /* ... */
});
kernel.lifecycleEvents.on('pluginFailed', e => {
  /* ... */
});
```

## Kernel Integration

During `kernel.init()`:

1. Resolve order and register declared hooks/events/errors/alerts
2. Start EventBus (buffered/sticky events are released)
3. Run phases: `beforeInit` → `init` → `afterInit`
4. Emit `pluginLoaded` per plugin
5. On error, emit `pluginFailed` and rethrow (`KernelError('LifecyclePhaseFailed')` for phase errors)

During `kernel.destroy()`:

- Run phases: `beforeDestroy` → `destroy` → `afterDestroy`
- Clear registry and internal state

## Plugin Implementation Example

```ts
import type { PluginInstance } from '../core/types';

class MyPlugin implements PluginInstance {
  metadata = { name: 'my', version: '1.0.0' } as const;
  [k: symbol]: unknown;

  async beforeInit(): Promise<void> {
    /* pre-warm caches */
  }
  async init(): Promise<void> {
    /* allocate resources */
  }
  async afterInit(): Promise<void> {
    /* health checks */
  }

  async beforeDestroy(): Promise<void> {
    /* flush queues */
  }
  async destroy(): Promise<void> {
    /* close connections */
  }
  async afterDestroy(): Promise<void> {
    /* finalize reports */
  }
}
```

> When using `definePlugin`, you typically implement behavior inside `setup(ctx)`; lifecycle function methods are more common for class-based plugins, or for advanced coordination.

## Error Handling

- Phase errors are wrapped as `KernelError('LifecyclePhaseFailed')`
- Kernel forwards lifecycle failures to `ErrorBus` (namespace `kernel`) with source `lifecycle`
- Use `kernel.errors.on('kernel', 'LifecyclePhaseFailed', ...)` to observe failures centrally

## Recommendations

- Keep lifecycle methods idempotent; they might be retried by policies
- Fail fast in `init` to avoid partial startup; release resources in `destroy`
- Use `beforeInit/afterInit` for ordering-sensitive prep/finalization
- Prefer doing runtime work in plugin APIs; lifecycle should set up/tear down
