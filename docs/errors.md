# Errors Layer

The Errors layer provides structured error reporting and routing. It includes a generic ErrorBus for namespaced kinds, and kernel-specific error types (`KernelError`) used by core subsystems.

## Concepts

- Namespaces: group error kinds per domain or plugin (e.g., `events`, `hooks`, `kernel`, `auth`)
- Kinds: error names under a namespace (e.g., `HandlerError`, `InvalidCredentials`)
- Handlers: subscribers listen to `(namespace, kind)` and receive a payload plus optional metadata
- Policies: pluggable strategies (log, sentry, retry, transform) that you can apply in handlers or adapters

## API Surface

See `src/errors/error-bus.ts`.

- `ErrorBus`
  - `on(namespace, kind, handler) → () => void`
  - `off(namespace, kind, handler) → void`
  - `emit(namespace, kind, payload, meta?) → Promise<void>`
- Helpers
  - `defineError()` — marker for declarative error specs
  - `createErrors(namespace, spec)` — returns `{ namespace, kinds }`
  - `bindErrors(bus, namespace, spec)` — returns `{ throw, on }` bound to the namespace/kinds for better DX

### Example

```ts
import { ErrorBus } from '../errors/error-bus';

const errors = new ErrorBus();

const off = errors.on('auth', 'InvalidCredentials', (payload, meta) => {
  // send to log/sentry/etc.
});

await errors.emit('auth', 'InvalidCredentials', { reason: '...' }, { source: 'custom' });
off();
```

### Declarative + helper

```ts
import { bindErrors, createErrors, defineError } from '../errors/error-bus';

const spec = createErrors('auth', { InvalidCredentials: defineError() });
const authErrors = bindErrors(errors, spec.namespace, { InvalidCredentials: defineError() });

const off = authErrors.on('InvalidCredentials', p => {
  /* ... */
});
await authErrors.throw('InvalidCredentials', { reason: '...' });
```

## Kernel errors

Core subsystems raise `KernelError` instances with a `code` and `details`. See `src/errors/kernel-errors.ts`.

### Codes

- `DependencyMissing` — plugin requires a dependency that is not present
- `DependencyVersionUnsatisfied` — version constraint not satisfied
- `DependencyCycle` — cycle detected in dependency order
- `LifecyclePhaseFailed` — a lifecycle phase threw
- `InvalidVersionSpec` — invalid semver range or actual version

### Example

```ts
import { isKernelError } from '../errors/kernel-errors';

try {
  await kernel.init();
} catch (err) {
  if (isKernelError(err)) {
    // handle by code, forward to ErrorBus, etc.
  }
}
```

## Integration

- EventBus: handler exceptions are routed to `ErrorBus` namespace `events` with kind `HandlerError`
- HookBus: handler exceptions are routed to `ErrorBus` namespace `hooks` with kind `HandlerError`
- Lifecycle: failures are wrapped as `KernelError('LifecyclePhaseFailed')` and also emitted to `ErrorBus` namespace `kernel`

## Policies

Examples in `src/errors/policies.ts`:

- `logPolicy(logger)` — log error with metadata
- `sentryPolicy(sdk)` — forward to Sentry SDK
- `retryPolicy(handler, { retries, delayMs? })` — retry a handler on failure with optional delay

Policies are usually applied in subscribers:

```ts
const off = errors.on('events', 'HandlerError', (payload, meta) =>
  logPolicy(logger)(payload, meta)
);
```

## Recommendations

- Handle kernel error codes explicitly in higher-level tooling (e.g., map to user-facing messages)
- Ensure error handlers are robust and non-throwing; if needed, apply `retryPolicy`
- Keep payloads structured and minimal; prefer primitives/POJOs for transport
- Route critical errors to monitoring (Sentry, ELK, etc.) via policies or adapters
