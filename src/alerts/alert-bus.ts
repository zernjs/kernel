import type { AlertHandler, AlertHandlersByNamespace, IAlertBus, IAlertChannel } from '@types';
import { isPlainObject } from '@utils';

export class AlertBus implements IAlertBus {
  private readonly handlers: AlertHandlersByNamespace = new Map();
  private readonly channels: IAlertChannel[] = [];

  on<Payload = unknown>(
    namespace: string,
    kind: string,
    handler: AlertHandler<Payload>
  ): () => void {
    if (!this.handlers.has(namespace)) this.handlers.set(namespace, new Map());
    const ns = this.handlers.get(namespace)!;
    if (!ns.has(kind)) ns.set(kind, new Set());
    const set = ns.get(kind)!;
    set.add(handler as AlertHandler<unknown>);
    return () => this.off(namespace, kind, handler as AlertHandler<unknown>);
  }

  off(namespace: string, kind: string, handler: AlertHandler<unknown>): void {
    const ns = this.handlers.get(namespace);
    if (!ns) return;
    const set = ns.get(kind);
    if (!set) return;
    set.delete(handler);
  }

  async emit<Payload = unknown>(namespace: string, kind: string, payload: Payload): Promise<void> {
    // shallow freeze payload if plain object to prevent accidental mutations downstream
    if (isPlainObject(payload)) Object.freeze(payload);
    const ns = this.handlers.get(namespace);
    const set = ns?.get(kind);
    if (!set || set.size === 0) return;
    for (const h of Array.from(set) as AlertHandler<Payload>[]) await h(payload);
    // dispatch to channels after subscribers
    for (const ch of this.channels) await ch.dispatch(namespace, kind, payload);
  }

  useChannel(channel: IAlertChannel): void {
    this.channels.push(channel);
  }
}

export function defineAlert(): { __type: 'alert-def' } {
  return { __type: 'alert-def' } as const;
}

export function createAlerts(
  namespace: string,
  spec: Record<string, ReturnType<typeof defineAlert>>
): {
  namespace: string;
  kinds: ReadonlyArray<keyof typeof spec & string>;
} {
  return { namespace, kinds: Object.keys(spec) as Array<keyof typeof spec & string> } as const;
}

export function bindAlerts<TSpec extends Record<string, ReturnType<typeof defineAlert>>>(
  bus: AlertBus,
  namespace: string,
  _spec: TSpec
): {
  emit: <K extends keyof TSpec & string, P = unknown>(kind: K, payload: P) => Promise<void>;
  on: <K extends keyof TSpec & string, P = unknown>(
    kind: K,
    handler: AlertHandler<P>
  ) => () => void;
} {
  return {
    emit: async (kind, payload): Promise<void> => {
      await bus.emit(namespace, kind as string, payload);
    },
    on: (kind, handler): (() => void) =>
      bus.on(namespace, kind as string, handler as AlertHandler<unknown>),
  };
}
