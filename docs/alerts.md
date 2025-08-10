# Alerts Layer

The Alerts layer provides a lightweight, structured way to broadcast notifications (informational, warnings, UX-facing alerts, etc.) across plugins. Unlike ErrorBus (which represents fault conditions), the AlertBus is semantic-neutral and geared towards user/system notifications with pluggable delivery channels.

## Concepts

- Namespaces: Alerts are organized by namespace (typically the plugin name)
- Kinds: Each namespace defines alert "kinds" (e.g., `Info`, `Warning`, `Success`)
- Handlers: Subscribers listen to `(namespace, kind)`
- Channels: Output sinks (e.g., console, webhook) that can be plugged in by higher-level tooling or plugins

## API Surface

The core types live under `src/alerts/alert-bus.ts`.

- `AlertBus`
  - `on(namespace, kind, handler) → () => void`
  - `off(namespace, kind, handler) → void`
  - `emit(namespace, kind, payload) → Promise<void>`
- Helpers
  - `defineAlert()` — marker for declarative alert specs
  - `createAlerts(namespace, spec)` — declarative definition returning `{ namespace, kinds }`
  - `bindAlerts(bus, namespace, spec)` — DX helper that returns `{ emit, on }` bound to the namespace and kinds
- Channels (examples in `src/alerts/channels.ts`)
  - `consoleChannel(prefix?)` — writes to `console.warn`
  - `webhookChannel(fetchFn, url)` — sends alerts to a webhook endpoint

## Basic Usage

### Emitting and subscribing directly

```ts
import { AlertBus } from '../alerts/alert-bus';

const alerts = new AlertBus();

const off = alerts.on('ui', 'Info', p => {
  // handle info alerts
  console.log('UI Info:', p);
});

await alerts.emit('ui', 'Info', { message: 'Welcome!' });
off();
```

### Declarative definition (per plugin)

```ts
import { definePlugin } from '../plugin/definePlugin';
import { createAlerts, defineAlert } from '../alerts/alert-bus';

const uiAlerts = createAlerts('ui', {
  Info: defineAlert(),
  Warning: defineAlert(),
});

export const UiPlugin = definePlugin({
  name: 'ui',
  version: '1.0.0',
  alerts: { namespace: uiAlerts.namespace, kinds: uiAlerts.kinds },
  async setup({ kernel }) {
    // later, any code can emit
    await kernel.alerts.emit('ui', 'Info', { message: 'Hello' });
    return {};
  },
});
```

### DX helper with bindAlerts

```ts
import { bindAlerts, createAlerts, defineAlert } from '../alerts/alert-bus';

const spec = createAlerts('payments', { Success: defineAlert(), Failure: defineAlert() });
const payments = bindAlerts(kernel.alerts, spec.namespace, {
  Success: defineAlert(),
  Failure: defineAlert(),
});

// subscribers
const off = payments.on('Success', p => {
  /* ... */
});
// emitters
await payments.emit('Success', { id: 'p1', amount: 100 });
```

## Channels

Channels are higher-level adapters for delivering alerts outward. They can be composed in application code or as plugins.

- `consoleChannel(prefix?: string)`
  - Example: `const ch = consoleChannel('[ALERT]'); ch('ui', 'Info', { message: 'Hi' });`
- `webhookChannel(fetchFn, url: string)`
  - Sends JSON payload `{ namespace, kind, payload }` to a remote endpoint

You can implement custom channels with the signature:

```ts
type AlertChannel = (namespace: string, kind: string, payload: unknown) => Promise<void> | void;
```

## Recommended Patterns

- Treat Alerts as “user/system notifications,” not errors or exceptions
- Keep payloads small and serializable (plain objects)
- Centralize subscription/forwarding to channels in a small adapter layer/plugin
- Namespaces: use plugin names to avoid collisions (e.g., `ui`, `payments`, `auth`)

## Differences vs ErrorBus

- ErrorBus signals fault conditions and integrates with error policies (log, sentry, retry)
- Alerts are neutral notifications typically surfaced to users/ops channels (console, webhooks, UI)
- Both are namespaced and support typed DX via their helpers

## Testing Tips

- Use the returned unsubscribe from `.on(...)` to clean up listeners in tests
- E2E: assert that alerts are received or forwarded to channels as expected
- Avoid time-coupled tests; `emit` is async, so `await` calls before assertions
