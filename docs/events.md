# Events Layer

The Events layer provides a namespaced, type-friendly event bus with startup/delivery modes, middlewares, and adapters. It enables plugins and users to publish/subscribe to structured events with predictable behavior across the kernel lifecycle.

## Concepts

- Namespaces: Events are grouped by namespace (typically the plugin name), e.g., `kernel.events.namespace('auth')`
- Delivery modes: `sync | microtask | async` — how handlers are invoked
- Startup modes: `drop | buffer | sticky`
  - `drop`: emissions before `events.start()` are ignored
  - `buffer`: emissions before start are queued (bounded by `bufferSize`) and delivered after start
  - `sticky`: only the latest pre-start emission is kept and delivered once to late subscribers
- Middlewares: Interceptors around emission, at global, namespace, or event level
- Adapters: Optional bridges to external/event systems (Node EventEmitter default, RxJS optional, custom adapters supported)

## API Surface

The core lives under `src/events/event-bus.ts`.

- `EventBus`
  - `namespace(name)` returns an object with:
    - `define(eventName, opts?) → Event<Payload>`
    - `get(eventName) → Event<Payload> | undefined`
    - `on(eventName, handler) → () => void`
    - `emit(eventName, payload) → Promise<void>`
    - `use(middleware)` — register namespace-level middleware
  - Global middlewares: `events.use(middleware)`
  - Adapters: `events.useAdapter(adapter)`
  - Error routing: `events.onError((namespace, eventName, err) => void)`
  - Lifecycle: `events.start()` (called by Kernel during init)
- `Event<Payload>`
  - `on(handler) → () => void`
  - `off(handler) → void`
  - `emit(payload) → Promise<void>`
  - `once() → Promise<Payload>`
  - `use(middleware)` — per-event middleware (optional helper)
  - `pipe()` — minimal placeholder for future operator pipelines
- Declarative helpers
  - `event(opts?)` — returns an event definition spec (for `definePlugin`)
  - `createEvents(namespace, spec)` — returns `{ namespace, spec }` used by `definePlugin`

### Options (EventOptions)

```ts
{
  delivery?: 'sync' | 'microtask' | 'async';
  startup?: 'drop' | 'buffer' | 'sticky';
  bufferSize?: number; // used when startup === 'buffer'
}
```

## Basic Usage

```ts
const ns = kernel.events.namespace('analytics');

// define + subscribe
ns.define('pageView', { delivery: 'microtask', startup: 'buffer', bufferSize: 10 });
const off = ns.on('pageView', p => {
  // handle payload
});

// emit (pre-start emissions are buffered in this example)
await ns.emit('pageView', { path: '/home' });

await kernel.init(); // EventBus is started during init
// buffered emissions are delivered after start

off();
```

### Declarative definition via plugin

```ts
import { definePlugin } from '../plugin/definePlugin';
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

## Middlewares

Middlewares intercept `emit` calls.

### Shapes

```ts
// Global/namespace/event middlewares have the same signature
(ctx: { namespace: string; eventName: string; payload: unknown }, next: () => Promise<void>) => Promise<void> | void
```

### Registering

```ts
// global
kernel.events.use(async (ctx, next) => {
  /* audit */ await next();
});

// namespace
const auth = kernel.events.namespace('auth');
auth.use((ctx, next) => next());

// per-event
const login = auth.define('login');
login.use?.((ctx, next) => next());
```

Recommended uses: auditing, security checks, light transforms, or dispatch policies. Heavy policies/operators should live in a dedicated plugin.

## Adapters

Adapters mirror events outward or integrate with external systems.

### Default: Node EventEmitter

Registered by default (unless disabled). Emissions call `emitter.emit(`${namespace}:${event}`, payload)`.

### Optional: RxJS

Provide a subject factory and register the adapter via kernel options.

### Custom adapter interface

```ts
interface EventAdapter {
  name: string;
  onStart?(ctx: Record<string, unknown>): void;
  onNamespace?(ns: string): void;
  onDefine?(ns: string, ev: string, opts?: EventOptions): void;
  onEmit?(ns: string, ev: string, payload: unknown): void;
}
```

Register: `kernel.events.useAdapter(myAdapter)`

## Error routing

Exceptions thrown by event handlers are caught and forwarded to `ErrorBus` as:

- Namespace: `events`
- Kind: `HandlerError`
- Metadata: `{ source: 'event', namespace, eventName }`

Subscribe via:

```ts
kernel.errors.on('events', 'HandlerError', (err, meta) => {
  /* report */
});
```

## Buffering & sticky mechanics

- Emissions before `events.start()` follow the event’s `startup` mode
- Late subscribers to `sticky` events receive the latest value on `on(...)`
- `buffer` mode queues up to `bufferSize` payloads and flushes after start

## Notes

- The bus maintains small internal counters (emitted/delivered/errors) per `namespace:event` for basic diagnostics; for production metrics use an external registry via plugins/adapters.
- Keep payloads serializable, avoid “fat” objects across event boundaries.
