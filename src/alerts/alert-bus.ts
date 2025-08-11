/**
 * @file Alerts layer core: in-process publish/subscribe bus and helpers for declarative alert specs.
 * Exposes `AlertBus`, `defineAlert`, `createAlerts`, and `bindAlerts`.
 */
import type { AlertHandler, AlertHandlersByNamespace, IAlertBus, IAlertChannel } from '@types';
import { isPlainObject } from '@utils';

/**
 * Lightweight alert bus for broadcasting notifications to in-process subscribers
 * and out-of-process channels (e.g., console, webhooks).
 */
export class AlertBus implements IAlertBus {
  private readonly handlers: AlertHandlersByNamespace = new Map();
  private readonly channels: IAlertChannel[] = [];

  /**
   * Subscribe a handler to a namespaced alert kind.
   * @typeParam Payload - Payload type delivered to the handler.
   * @param namespace - Alerts namespace (e.g., 'ui').
   * @param kind - Alert kind within the namespace (e.g., 'Info').
   * @param handler - Sync or async handler invoked for each alert.
   * @returns Function to unsubscribe the handler.
   */
  on<Payload = unknown>(
    namespace: string,
    kind: string,
    handler: AlertHandler<Payload>
  ): () => void {
    const set = this.getOrCreateHandlerSet(namespace, kind);
    set.add(handler as AlertHandler<unknown>);
    return () => this.off(namespace, kind, handler as AlertHandler<unknown>);
  }

  /**
   * Unsubscribe a previously registered handler.
   * @param namespace - Alerts namespace.
   * @param kind - Alert kind.
   * @param handler - Handler instance to remove.
   * @returns void
   */
  off(namespace: string, kind: string, handler: AlertHandler<unknown>): void {
    const set = this.handlers.get(namespace)?.get(kind);
    if (!set) return;
    set.delete(handler);
  }

  /**
   * Emit an alert to subscribers and channels.
   * If the payload is a plain object, the bus freezes it to prevent accidental mutation.
   * @typeParam Payload - Emitted payload type.
   * @param namespace - Alerts namespace.
   * @param kind - Alert kind.
   * @param payload - Payload to deliver to handlers.
   * @returns Promise that resolves when all handlers and channels have been invoked.
   */
  async emit<Payload = unknown>(namespace: string, kind: string, payload: Payload): Promise<void> {
    const safePayload = this.ensureSafePayload(payload);
    const set = this.handlers.get(namespace)?.get(kind) as Set<AlertHandler<Payload>> | undefined;
    if (set && set.size > 0) {
      for (const h of Array.from(set)) await h(safePayload);
    }
    for (const ch of this.channels) await ch.dispatch(namespace, kind, safePayload);
  }

  /**
   * Register an outbound channel that receives every emitted alert.
   * @param channel - Channel sink that will receive all alerts.
   * @returns void
   */
  useChannel(channel: IAlertChannel): void {
    this.channels.push(channel);
  }

  private getOrCreateHandlerSet(namespace: string, kind: string): Set<AlertHandler<unknown>> {
    if (!this.handlers.has(namespace)) this.handlers.set(namespace, new Map());
    const ns = this.handlers.get(namespace)!;
    if (!ns.has(kind)) ns.set(kind, new Set());
    return ns.get(kind)!;
  }

  private ensureSafePayload<P>(payload: P): P {
    return isPlainObject(payload) ? (Object.freeze(payload) as P) : payload;
  }
}

/**
 * Declarative alert kind marker for plugin specifications.
 * @returns An opaque marker consumed by {@link createAlerts}.
 */
export function defineAlert(): { __type: 'alert-def' } {
  return { __type: 'alert-def' } as const;
}

/**
 * Build an alerts specification object consumable by `definePlugin`.
 * @param namespace - Alerts namespace (unique per plugin/domain).
 * @param spec - Object map of alert kinds created with {@link defineAlert}.
 * @returns `{ namespace, kinds }` with readonly kinds for compile-time safety.
 */
export function createAlerts(
  namespace: string,
  spec: Record<string, ReturnType<typeof defineAlert>>
): {
  namespace: string;
  kinds: ReadonlyArray<keyof typeof spec & string>;
} {
  return { namespace, kinds: Object.keys(spec) as Array<keyof typeof spec & string> } as const;
}

/**
 * Bind convenience `on`/`emit` helpers scoped to a namespace/kinds.
 * @param bus - Source alert bus.
 * @param namespace - Alerts namespace to bind.
 * @param _spec - Spec used for typing the allowed kinds (value is ignored at runtime).
 * @returns Bound `emit`/`on` helpers restricted to declared kinds.
 */
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
