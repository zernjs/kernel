# Resolve Layer

The Resolve layer determines the deterministic plugin load order using a weighted constraint graph and a stable topological sort.

## Goals

- Honor hard dependencies first
- Respect user-specified order (`before/after`) without violating dependencies
- Apply plugin-provided hints (`loadBefore/loadAfter`) as weakest guidance
- Produce a stable, reproducible order
- Report clear errors with `KernelError` codes

---

## Constraint Graph

Implemented in `src/resolve/constraint-graph.ts`.

- Nodes: plugin names
- Edges have a `type` and an implicit `weight`:
  - `dep` (weight 3) — hard dependency edge from dependency → dependent
  - `user` (weight 2) — user preference edge
  - `hint` (weight 1) — plugin-provided hint edge

Graph utilities:

- `addNode(name)`
- `addEdge(from, to, type)` — also adjusts incoming counts
- `getNodes()` / `getOutgoing(name)` / `getIncomingCount(name)` / `decrementIncoming(name)`

---

## Stable Topological Sort

Implemented in `src/resolve/topological-sort.ts` as `stableTopologicalSort(graph, prefer)`.

- Kahn’s algorithm with a deterministic `prefer(a, b)` tiebreaker (typically registration order)
- Throws `Error('Cyclic dependency detected while sorting plugins')` if a cycle remains
  - The Order Resolver catches and rethrows as `KernelError('DependencyCycle')`

---

## Order Resolver

Implemented in `src/resolve/order-resolver.ts` as `resolvePluginOrder({ plugins, userOrder })`.

Steps:

1. Build nodes for all plugins
2. Add `dep` edges from hard dependencies
3. Add `user` edges from `before/after` maps
4. Add `hint` edges from plugin metadata `loadBefore/loadAfter`
5. Topologically sort with deterministic preference
6. Validate declared dependencies / versions
   - Missing required dependency → `KernelError('DependencyMissing')`
   - Unsatisfied version → `KernelError('DependencyVersionUnsatisfied')`
   - Invalid version notation → `KernelError('InvalidVersionSpec')`

### Version validation

- Uses `utils/semver.ts` with basic support for `^`, `~`, `>=`, and exact versions
- Resolver guards invalid `range` or `actual` by checking parsability and raising `InvalidVersionSpec`

---

## Examples

### User order vs dependencies

```ts
// A depends on Core
class Core {
  metadata = { name: 'core', version: '1.0.0' } as const;
  [k: symbol]: unknown;
}
class A {
  metadata = { name: 'a', version: '1.0.0' } as const;
  [k: symbol]: unknown;
  static dependsOn = [Core];
}
class B {
  metadata = { name: 'b', version: '1.0.0' } as const;
  [k: symbol]: unknown;
}

// user enforces B after A, but Core must precede A
// Final: Core → A → B
```

### Plugin hints

```ts
class P1 {
  metadata = { name: 'p1', version: '1.0.0', loadAfter: ['p2'] } as const;
  [k: symbol]: unknown;
}
class P2 {
  metadata = { name: 'p2', version: '1.0.0' } as const;
  [k: symbol]: unknown;
}

// If no user rules conflict, result respects hint: p2 → p1
```

### Version errors

```ts
// Feature requires core ^2.x, but we have 1.0.0
class Core {
  metadata = { name: 'core', version: '1.0.0' } as const;
  [k: symbol]: unknown;
}
class Feature {
  metadata = {
    name: 'feature',
    version: '1.0.0',
    dependencies: [{ name: 'core', version: '^2.0.0' }],
  } as const;
  [k: symbol]: unknown;
}

// Order resolver throws KernelError('DependencyVersionUnsatisfied')
```

---

## Error Codes

- `DependencyMissing` — required dependency not found
- `DependencyVersionUnsatisfied` — version constraint not satisfied
- `DependencyCycle` — cycle detected during sort
- `InvalidVersionSpec` — invalid semver range or actual version string

Subscribe to errors via `ErrorBus` for centralized reporting.
