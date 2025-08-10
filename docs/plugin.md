# Plugin Layer

The Plugin layer defines how plugins are declared, composed, and extended. It centers around `definePlugin`, which promotes a return-first API (excellent DX and type inference) and optional declarative metadata (hooks/events/errors/alerts/augmentations).

## Goals

- Simple declaration with strong typing
- Return-first API from `setup(ctx)` for great autocomplete and tests
- Optional declarative specs (hooks/events/errors/alerts) registered by the Kernel during `init()`
- Safe composition via augmentations (declarative or programmatic)

---

## definePlugin

```ts
import { definePlugin } from '../plugin/definePlugin';
import type { PluginOptionsSpec } from '../plugin/options';

// Conceptual view of the spec (simplified):
// - ctx is INFERRED automatically from `dependsOn`
// - you don't need generics or explicit typing in setup(ctx)
interface PluginSpec<Name extends string = string, API extends object = Record<string, never>> {
  name: Name;
  version: string;
  description?: string;
  options?: PluginOptionsSpec; // validated at kernel.init and passed to setup
  dependsOn?:
    | readonly (new () => unknown)[]
    | readonly { plugin: new () => unknown; version?: string; optional?: boolean }[];
  loadBefore?: readonly string[];
  loadAfter?: readonly string[];
  hooks?: Record<string, { on: unknown; off: unknown; emit: unknown; once: unknown }>;
  events?: { namespace: string; spec: Record<string, { __type: 'event-def'; options?: unknown }> };
  errors?: { namespace: string; kinds: readonly string[] };
  alerts?: { namespace: string; kinds: readonly string[] };
  augments?: Partial<Record<string, Record<string, unknown>>>;
  setup(
    ctx: unknown, // no need to annotate explicitly in userland; it's inferred
    options?: unknown
  ): API | Promise<API>;
}
```

Context typing

- `ctx` é inferido automaticamente a partir de `dependsOn` (ex.: `dependsOn: [Database]` → `ctx.use('database')` tipado).
- Você pode usar `setup(ctx)` sem generics. Caso queira anotar manualmente, existe o alias opcional `ZKernelContext`.

### Minimal example

```ts
export const Database = definePlugin({
  name: 'database',
  version: '1.0.0',
  // Optional options schema example (pseudo)
  // options: { validator: zodAdapter(z.object({ dsn: z.string().url() })) },
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
```

The API returned from `setup()` is what users consume: `kernel.get('database')?.connect(...)`.

### With dependencies (ctx auto)

```ts
import { Database } from '../examples/database.plugin';

export const Auth = definePlugin({
  name: 'auth',
  version: '1.0.0',
  dependsOn: [Database], // ctx.use('database') tipado automaticamente
  async setup(ctx) {
    const db = ctx.use('database');
    if (!db.isConnected()) await db.connect('postgres://user:pass@localhost/db');
    return {
      async login(user: string, pass: string) {
        return true;
      },
    };
  },
});
```

---

## Declarative specs

The Kernel will register declared hooks/events/errors/alerts during `init()`.

### Hooks

```ts
const Auth = definePlugin({
  name: 'auth',
  version: '1.0.0',
  hooks: {
    onLogin: {} as unknown as { on: unknown; off: unknown; emit: unknown; once: unknown },
  },
  async setup({ kernel }) {
    await kernel.hooks.get<{ userId: string }>('auth.onLogin')?.emit({ userId: 'u1' });
    return {};
  },
});
```

### Events

```ts
import { createEvents, event } from '../events/event-bus';

const Analytics = definePlugin({
  name: 'analytics',
  version: '1.0.0',
  events: createEvents('analytics', {
    pageView: event({ delivery: 'microtask', startup: 'buffer' }),
  }),
  async setup() {
    return {};
  },
});
```

### Errors / Alerts

```ts
import { createErrors, defineError } from '../errors/error-bus';
import { createAlerts, defineAlert } from '../alerts/alert-bus';

const authErrors = createErrors('auth', { InvalidCredentials: defineError() });
const uiAlerts = createAlerts('ui', { Info: defineAlert(), Warning: defineAlert() });

const Auth = definePlugin({
  name: 'auth',
  version: '1.0.0',
  errors: { namespace: authErrors.namespace, kinds: authErrors.kinds },
  alerts: { namespace: uiAlerts.namespace, kinds: uiAlerts.kinds },
  async setup({ kernel }) {
    await kernel.errors.emit('auth', 'InvalidCredentials', { reason: '...' });
    await kernel.alerts.emit('ui', 'Info', { message: 'Hello' });
    return {};
  },
});
```

---

## Augmentations

Augmentations allow a plugin to extend another plugin’s API — either declaratively or programmatically via `ctx.extend`. The Kernel merges these augmentations during `init()`.

### Declarative

```ts
const Utils = definePlugin({
  name: 'utils',
  version: '1.0.0',
  augments: {
    database: {
      async backup(this: unknown, name: string) {
        /* ... */
      },
    },
  },
  async setup() {
    return {};
  },
});
```

### Programmatic

```ts
const Utils = definePlugin({
  name: 'utils',
  version: '1.0.0',
  async setup({ extend }) {
    extend?.('database', {
      async optimize() {
        /* ... */
      },
    });
    return {};
  },
});
```

> Conflict policy defaults to `error` in core. Future options may include `override` or `namespace` strategies.

---

## Dependencies & versions

Declare `dependsOn` using constructors (preferred for type accumulation) or detailed entries with version ranges and optional flags.

```ts
const Feature = definePlugin({
  name: 'feature',
  version: '1.0.0',
  dependsOn: [CorePlugin],
  async setup() {
    return {};
  },
});

const Feature2 = definePlugin({
  name: 'feature2',
  version: '1.0.0',
  dependsOn: [{ plugin: CorePlugin, version: '^2.0.0', optional: false }],
  async setup() {
    return {};
  },
});
```

- Order resolution prioritizes dependencies, then user `before/after`, then plugin `loadBefore/loadAfter` hints
- Version ranges are validated; failures raise `KernelError('DependencyVersionUnsatisfied')`
- Missing required dependencies raise `KernelError('DependencyMissing')`; cycles raise `KernelError('DependencyCycle')`

---

## Best practices

- Prefer return-first APIs em `setup()`; melhor autocomplete e testabilidade
- Use specs declarativas para hooks/events/errors/alerts e mantenha `setup` enxuto
- Keep augmentation fragments small and narrowly scoped
- Avoid heavy work in `setup()`; use lifecycle and runtime APIs appropriately
- Version your plugins semantically and declare `dependsOn` with explicit ranges when needed
