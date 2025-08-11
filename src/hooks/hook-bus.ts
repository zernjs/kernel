/**
 * @file Hook bus with error reporting and debounce/throttle utilities.
 */
import type { Hook, HookErrorHandler, HookName, HookNamespaceApiTyped, HookDef } from '@types';
import { hook } from '@hooks';
import type { ErrorBus } from '@errors';
import { defineErrors } from '@errors';
import { debounce, throttle } from '@utils';

export class HookBus {
  private readonly hookMap = new Map<string, Hook<unknown>>();
  private readonly onHandlerError?: HookErrorHandler;
  private isReady = false;
  public readonly ns: Record<string, HookNamespaceApiTyped<Record<string, HookDef>>> = new Proxy(
    {},
    {
      get: (_t, prop: string): HookNamespaceApiTyped<Record<string, HookDef>> =>
        this.namespace(prop),
    }
  );

  constructor(errorBus?: ErrorBus) {
    this.onHandlerError = this.createErrorReporter(errorBus);
  }

  start(): void {
    if (this.isReady) return;
    this.isReady = true;
  }

  /** Namespaced API similar to events.namespace(ns) */
  namespace<TSpec extends Record<string, HookDef>>(
    namespaceName: string
  ): HookNamespaceApiTyped<TSpec> {
    const prefix = `${namespaceName}.`;
    return {
      define: <P>(name: string): Hook<P> => this.define<P>(prefix + name) as Hook<P>,
      get: <P>(name: string): Hook<P> | undefined => this.get<P>(prefix + name),
      on: <P>(name: string, handler: (p: P) => void | Promise<void>): (() => void) =>
        this.on<P>(prefix + name, handler),
      emit: async <P>(name: string, payload: P): Promise<void> =>
        this.emit<P>(prefix + name, payload),
    } as HookNamespaceApiTyped<TSpec>;
  }

  /** Flat API: key is "namespace.name" */
  on<Payload = unknown>(key: string, handler: (p: Payload) => void | Promise<void>): () => void {
    const hook = this.define<Payload>(key);
    return hook.on(handler);
  }

  async emit<Payload = unknown>(key: string, payload: Payload): Promise<void> {
    const hook = this.define<Payload>(key);
    await hook.emit(payload);
  }

  define<Payload>(name: HookName): Hook<Payload> & {
    debounce: (ms: number) => Hook<Payload>;
    throttle: (ms: number) => Hook<Payload>;
  } {
    const base = hook<Payload>(
      this.onHandlerError ? (err: unknown): void => this.onHandlerError?.(name, err) : undefined
    );

    this.storeHook(name, base as unknown as Hook<unknown>);
    return this.decorateWithUtilities(base);
  }

  get<Payload>(name: HookName): Hook<Payload> | undefined {
    return this.hookMap.get(name) as Hook<Payload> | undefined;
  }

  private storeHook(name: HookName, h: Hook<unknown>): void {
    this.hookMap.set(name, h);
  }

  private createErrorReporter(errorBus?: ErrorBus): HookErrorHandler | undefined {
    if (!errorBus) return undefined;
    const HooksErrors = defineErrors('hooks', { HandlerError: (e: unknown) => e });
    const { HandlerError } = HooksErrors.factories;
    return (name: string, err: unknown): void => {
      void errorBus.Throw(HandlerError(err), { source: 'hook', eventName: name });
    };
  }

  private withOn<Payload>(h: Hook<Payload>, onOverride: Hook<Payload>['on']): Hook<Payload> {
    return { ...h, on: onOverride };
  }

  private decorateWithUtilities<Payload>(h: Hook<Payload>): Hook<Payload> & {
    debounce: (ms: number) => Hook<Payload>;
    throttle: (ms: number) => Hook<Payload>;
  } {
    const withUtils = h as Hook<Payload> & {
      debounce: (ms: number) => Hook<Payload>;
      throttle: (ms: number) => Hook<Payload>;
    };

    withUtils.debounce = (ms: number): Hook<Payload> => {
      const originalOn = h.on;
      const debouncedOn: Hook<Payload>['on'] = handler =>
        originalOn(debounce(handler as (arg: unknown) => unknown, ms) as (p: Payload) => void);
      return this.withOn(h, debouncedOn);
    };

    withUtils.throttle = (ms: number): Hook<Payload> => {
      const originalOn = h.on;
      const throttledOn: Hook<Payload>['on'] = handler =>
        originalOn(throttle(handler as (arg: unknown) => unknown, ms) as (p: Payload) => void);
      return this.withOn(h, throttledOn);
    };

    return withUtils;
  }
}

/**
 * Declarative helpers (parity with events)
 */
export function defineHook<Payload = unknown>(): {
  __type: 'hook-def';
  __payload?: Payload;
} {
  return { __type: 'hook-def' } as const;
}

export function createHooks<TSpec extends Record<string, ReturnType<typeof defineHook<unknown>>>>(
  namespace: string,
  spec: TSpec
): { namespace: string; spec: TSpec } {
  return { namespace, spec } as const;
}

export function bindHooks<TSpec extends Record<string, ReturnType<typeof defineHook<unknown>>>>(
  bus: HookBus,
  descriptor: { namespace: string; spec: TSpec }
): {
  emit: <K extends keyof TSpec & string>(
    name: K,
    payload: TSpec[K] extends { __payload?: infer P } ? P : unknown
  ) => Promise<void>;
  on: <K extends keyof TSpec & string>(
    name: K,
    handler: (
      payload: TSpec[K] extends { __payload?: infer P } ? P : unknown
    ) => void | Promise<void>
  ) => () => void;
} {
  const { namespace, spec } = descriptor;
  void spec;
  const ns = bus.namespace(namespace);
  return {
    emit: async (name, payload): Promise<void> => ns.emit(name as string, payload as unknown),
    on: (name, handler): (() => void) => ns.on(name as string, handler as (p: unknown) => void),
  } as const;
}
