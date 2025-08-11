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
  - `on(factory, handler) → () => void`
  - `Throw(token, meta?) → Promise<void>` — reporta no bus (não lança)
  - `Raise(token, meta?) → never` — reporta e lança `ReportedError`
- Helpers
  - `defineErrors(namespace, spec)` — unifica declaração + factories tipadas
  - `createErrorFactory(namespace, kind)` — cria uma factory isolada (baixo nível)
  - Tipos: `ErrorFactory`, `ErrorToken`, `ReportedError`

### Example

```ts
import { ErrorBus, defineErrors } from '../errors';

const errors = new ErrorBus();
const AuthErrors = defineErrors('auth', { InvalidCredentials: (p: { reason: string }) => p });
const { InvalidCredentials } = AuthErrors.factories;

const off = errors.on(InvalidCredentials, (payload, meta) => {
  // send to log/sentry/etc.
});

await errors.Throw(InvalidCredentials({ reason: '...' }), { source: 'custom' });
off();
```

### Declarative + helper

```ts
import { defineErrors } from '../errors';

const Auth = defineErrors('auth', { InvalidCredentials: (p: { reason: string }) => p });
const { InvalidCredentials } = Auth.factories;

const off = errors.on(InvalidCredentials, p => {
  /* ... */
});
await errors.Throw(InvalidCredentials({ reason: '...' }));
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

- EventBus: handler exceptions são encaminhadas via `Throw(Events.HandlerError(...))`
- HookBus: (reservado) encaminhamento via `Throw(Hooks.HandlerError(...))`
- Lifecycle: falhas são encapsuladas em `KernelError(...)` e encaminhadas via factories

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
