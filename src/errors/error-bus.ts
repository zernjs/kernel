import type { ErrorHandler, ErrorMeta } from '@types';

export class ErrorBus {
  private readonly handlers = new Map<string, Map<string, Set<ErrorHandler<unknown>>>>();

  on<Payload = unknown>(
    namespace: string,
    kind: string,
    handler: ErrorHandler<Payload>
  ): () => void {
    if (!this.handlers.has(namespace)) this.handlers.set(namespace, new Map());
    const ns = this.handlers.get(namespace)!;
    if (!ns.has(kind)) ns.set(kind, new Set());
    const set = ns.get(kind)!;
    set.add(handler as ErrorHandler<unknown>);
    return () => this.off(namespace, kind, handler as ErrorHandler<unknown>);
  }

  off(namespace: string, kind: string, handler: ErrorHandler<unknown>): void {
    const ns = this.handlers.get(namespace);
    if (!ns) return;
    const set = ns.get(kind);
    if (!set) return;
    set.delete(handler);
  }

  async emit<Payload = unknown>(
    namespace: string,
    kind: string,
    payload: Payload,
    meta?: ErrorMeta
  ): Promise<void> {
    const ns = this.handlers.get(namespace);
    const set = ns?.get(kind);
    if (!set || set.size === 0) return;
    for (const h of Array.from(set) as ErrorHandler<Payload>[]) await h(payload, meta);
  }
}

export function defineError(): { __type: 'error-def' } {
  return { __type: 'error-def' } as const;
}

export function createErrors(
  namespace: string,
  spec: Record<string, ReturnType<typeof defineError>>
): {
  namespace: string;
  kinds: ReadonlyArray<keyof typeof spec & string>;
} {
  return { namespace, kinds: Object.keys(spec) as Array<keyof typeof spec & string> } as const;
}

// Binds a namespaced errors helper over the ErrorBus for DX
export function bindErrors<TSpec extends Record<string, ReturnType<typeof defineError>>>(
  bus: ErrorBus,
  namespace: string,
  _spec: TSpec
): {
  throw: <K extends keyof TSpec & string, P = unknown>(kind: K, payload: P) => Promise<void>;
  on: <K extends keyof TSpec & string, P = unknown>(
    kind: K,
    handler: ErrorHandler<P>
  ) => () => void;
} {
  return {
    throw: async (kind, payload): Promise<void> => {
      await bus.emit(namespace, kind as string, payload);
    },
    on: (kind, handler): (() => void) =>
      bus.on(namespace, kind as string, handler as ErrorHandler<unknown>),
  };
}
