# Diagnostics Layer

The Diagnostics layer provides simple primitives for logging, metrics, and debug helpers. It is intentionally lightweight in the core to avoid coupling, while enabling richer integrations through plugins.

## Logger

The logger is a minimal interface you can adapt or replace. See `src/diagnostics/logger.ts`.

### Capabilities

- Log levels and child loggers
- Pluggable sink (you can wrap it to forward logs elsewhere)

### Example

```ts
import { createLogger } from '../diagnostics/logger';

const log = createLogger({ level: 'info', name: 'kernel' });
log.info('kernel starting');
const child = log.child({ component: 'lifecycle' });
child.debug('phase begin', { phase: 'init' });
```

## Metrics

In-memory counters and histograms are available for basic instrumentation. See `src/diagnostics/metrics.ts`.

### Interfaces

- `Counter`: `inc(delta?)`, `reset()`, `value()`
- `Histogram`: `observe(ms)`, `values()`, `reset()`
- `MetricsRegistry`: `counter(name)`, `histogram(name)`

### Example

```ts
import { createInMemoryMetrics } from '../diagnostics/metrics';

const metrics = createInMemoryMetrics();
const started = metrics.counter('kernel.started');
const initTimes = metrics.histogram('kernel.init.ms');

started.inc();
initTimes.observe(12.5);
```

### Notes

- The in-memory registry grows with the number of unique metric names; keep cardinality bounded
- For long-running deployments, consider exporting to an external system (Prometheus, OpenTelemetry) via a plugin/adapter

## Debug helpers

A small set of helpers is provided in `src/diagnostics/debug.ts` (e.g., object dumps). These are convenient for development and test output.

### Example

```ts
import { dumpObject } from '../diagnostics/debug';

dumpObject({ plugins: kernel.loadedPlugins });
```

## Recommendations

- Keep logs structured (JSON fields) for better observability downstream
- Use counters for discrete events (e.g., events emitted), histograms for durations
- Avoid high-cardinality metric names; prefer prefixes + known labels in adapters
- In production, forward logs/metrics to external systems via plugins/adapters
