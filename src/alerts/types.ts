export type AlertNamespace = string;
export type AlertKind = string;

export type AlertHandler<Payload> = (payload: Payload) => void | Promise<void>;

export type AlertHandlersByKind = Map<AlertKind, Set<AlertHandler<unknown>>>;
export type AlertHandlersByNamespace = Map<AlertNamespace, AlertHandlersByKind>;

export interface IAlertChannel {
  dispatch(namespace: AlertNamespace, kind: AlertKind, payload: unknown): Promise<void> | void;
}

export interface IAlertBus {
  on<Payload = unknown>(
    namespace: AlertNamespace,
    kind: AlertKind,
    handler: AlertHandler<Payload>
  ): () => void;
  off(namespace: AlertNamespace, kind: AlertKind, handler: AlertHandler<unknown>): void;
  emit<Payload = unknown>(
    namespace: AlertNamespace,
    kind: AlertKind,
    payload: Payload
  ): Promise<void>;
}
