/**
 * @file Public types for the Alerts layer.
 */
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

/** -------------------------
 * Declarative + typed overlay (DX parity with events)
 * ------------------------- */

export type AlertDef<Payload = unknown> = {
  __type: 'alert-def';
  __payload?: Payload;
};

export type AlertPayloadOf<A> = A extends { __payload?: infer P } ? P : unknown;

export type AlertNamespaceApiTyped<TSpec extends Record<string, AlertDef>> = {
  on: <K extends keyof TSpec & string, P = AlertPayloadOf<TSpec[K]>>(
    kind: K,
    handler: AlertHandler<P>
  ) => () => void;
  emit: <K extends keyof TSpec & string>(
    kind: K,
    payload: AlertPayloadOf<TSpec[K]>
  ) => Promise<void>;
};

// Global flat API typing helpers
type JoinNsKind<TMap extends Record<string, Record<string, AlertDef>>> = {
  [N in keyof TMap & string]: {
    [K in keyof TMap[N] & string]: `${N}.${K}`;
  }[keyof TMap[N] & string];
}[keyof TMap & string];

type NsOf<K extends string> = K extends `${infer N}.${string}` ? N : never;
type KindOf<K extends string> = K extends `${string}.${infer E}` ? E : never;

type PayloadOfAlertKey<
  TMap extends Record<string, Record<string, AlertDef>>,
  K extends string,
> = AlertPayloadOf<TMap[NsOf<K> & keyof TMap][KindOf<K> & keyof TMap[NsOf<K> & keyof TMap]]>;

export type TypedAlerts<TMap extends Record<string, Record<string, AlertDef>>> = Omit<
  import('./alert-bus').AlertBus,
  'namespace' | 'on' | 'emit'
> & {
  namespace: <K extends keyof TMap & string>(namespaceName: K) => AlertNamespaceApiTyped<TMap[K]>;
  ns: { [K in keyof TMap & string]: AlertNamespaceApiTyped<TMap[K]> };
  on: (
    key: JoinNsKind<TMap>,
    handler: (
      payload: PayloadOfAlertKey<TMap, Extract<JoinNsKind<TMap>, string>>
    ) => void | Promise<void>
  ) => () => void;
  emit: (
    key: JoinNsKind<TMap>,
    payload: PayloadOfAlertKey<TMap, Extract<JoinNsKind<TMap>, string>>
  ) => Promise<void>;
};

export interface ZernAlerts {
  __zern_alerts_brand?: never;
}

export type GlobalAlertMap = {
  [K in keyof ZernAlerts & string]: ZernAlerts[K] extends Record<string, AlertDef>
    ? ZernAlerts[K]
    : never;
};
