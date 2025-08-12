/**
 * @file Library root and DX helpers.
 * @module zern-kernel
 * @remarks
 * Exposes core layers via named namespaces (e.g., `core`, `errors`),
 * and provides small ergonomic helpers that transparently initialize a global Kernel
 * the first time they are used. This lets consumers import a feature and start
 * using it immediately without manual bootstrapping.
 *
 * - Namespaced re-exports: `core`, `plugin`, `errors`, `lifecycle`, `resolver`, `diagnostics`, `utils`, `types`.
 * - Global Kernel helpers: {@link getKernel}, {@link ensureKernel}, {@link withKernel}.
 * - Layer helpers: {@link useErrors}.
 * - Convenience emitters: removed (events/hooks/alerts not in core).
 */
export * as core from './core';
export * as diagnostics from './diagnostics';
export * as errors from './errors';
export * as lifecycle from './lifecycle';
export * as plugin from './plugin';
export * as resolver from './resolve';
export * as types from './types';
export * as utils from './utils';

import { createKernel } from './core/createKernel';
import type { Kernel } from './core/kernel';

/**
 * Internal global builder singleton used by {@link getKernel} and {@link ensureKernel}.
 * It is created lazily and cached for the process lifetime.
 */
let kernelSingleton: ReturnType<typeof createKernel> | null = null;

/**
 * Get (or create) the global Kernel builder.
 * @returns KernelBuilder instance created by {@link createKernel}.
 */
export function getKernel(): ReturnType<typeof createKernel> {
  if (!kernelSingleton) kernelSingleton = createKernel();
  return kernelSingleton;
}

/**
 * Initialize and return the global Kernel instance.
 * @returns A fully initialized {@link Kernel} instance.
 * @example
 * ```ts
 * import { ensureKernel } from '@zern/kernel';
 * const kernel = await ensureKernel();
 * // use kernel as needed
 * ```
 */
export async function ensureKernel(): Promise<Kernel> {
  const builder = getKernel();
  const kernel = builder.build() as unknown as Kernel & { __initialized?: boolean };
  if (kernel.__initialized !== true) {
    await kernel.init();
    kernel.__initialized = true;
  }
  return kernel as Kernel;
}

/**
 * Ensure the Kernel is initialized and then project a value from it.
 * @typeParam T - Return type of the selector.
 * @param select - Selector invoked with the initialized Kernel.
 * @returns The selector return value.
 */
export async function withKernel<T>(select: (k: Kernel) => T | Promise<T>): Promise<T> {
  const k = await ensureKernel();
  return await select(k);
}

/**
 * Resolve the global {@link Kernel} instance (ensuring initialization when necessary).
 * @returns Initialized {@link Kernel}.
 */
export async function useKernel(): Promise<Kernel> {
  return await ensureKernel();
}

/**
 * Get the ErrorBus from the global Kernel.
 * @returns Kernel.errors
 */
export async function useErrors(): Promise<Kernel['errors']> {
  return await withKernel(k => k.errors);
}

/**
 * Typed global error helpers with autocomplete (quando possível) e payload inferido.
 * Se o mapa de erros não for inferível via Kernel global, há fallback para `${string}.${string}` e payload unknown.
 */
import type * as ErrT from './errors/types';
import type { PluginInstance } from './types';

type InferErrorMap =
  Awaited<ReturnType<typeof ensureKernel>> extends Kernel<
    Record<string, PluginInstance>,
    Record<string, object>,
    infer M extends Record<string, Record<string, ErrT.ErrorDef<unknown>>>
  >
    ? M
    : Record<never, never>;

type ErrorKey =
  ErrT.JoinNsKind<InferErrorMap> extends never
    ? `${string}.${string}`
    : ErrT.JoinNsKind<InferErrorMap>;

type PayloadFor<K> =
  K extends ErrT.JoinNsKind<InferErrorMap>
    ? ErrT.PayloadOfErrorKey<InferErrorMap, Extract<K, ErrT.JoinNsKind<InferErrorMap>>>
    : unknown;

const splitKey = (key: string): [string, string] => {
  const i = key.indexOf('.');
  return i <= 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)];
};

export async function report<K extends ErrorKey>(
  key: K,
  payload: PayloadFor<K>,
  meta?: ErrT.ErrorMeta
): Promise<void> {
  return withKernel(async k => {
    const [ns, kind] = splitKey(key as string);
    await k.errors.namespace(ns).report(kind, payload as unknown, meta);
  });
}

export async function fail<K extends ErrorKey>(
  key: K,
  payload: PayloadFor<K>,
  meta?: ErrT.ErrorMeta
): Promise<never> {
  return withKernel(async k => {
    const [ns, kind] = splitKey(key as string);
    return await k.errors.namespace(ns).fail(kind, payload as unknown, meta);
  });
}

export async function once<K extends ErrorKey>(key: K): Promise<PayloadFor<K>> {
  return withKernel(async k => {
    const [ns, kind] = splitKey(key as string);
    return await new Promise<PayloadFor<K>>(resolve => {
      const off = k.errors.namespace(ns).on(kind, (p: unknown) => {
        off();
        resolve(p as PayloadFor<K>);
      });
    });
  });
}

export async function on<K extends ErrorKey>(
  key: K,
  handler: (payload: PayloadFor<K>, meta?: ErrT.ErrorMeta) => void | Promise<void>
): Promise<() => void> {
  return withKernel(async k => {
    const [ns, kind] = splitKey(key as string);
    return k.errors
      .namespace(ns)
      .on(kind, handler as (p: unknown, m?: ErrT.ErrorMeta) => void | Promise<void>);
  });
}

/**
 * Helpers vinculados a um Kernel concreto (preferidos para DX com autocomplete/payload inferido).
 * Não usam any; inferem M via condicional sobre K.
 */
export function createErrorHelpers<
  P extends Record<string, PluginInstance>,
  A extends Record<string, object>,
  M extends Record<string, Record<string, ErrT.ErrorDef<unknown>>>,
>(
  kernel: Kernel<P, A, M>
): {
  report<K extends ErrT.JoinNsKind<M>>(
    key: K,
    payload: ErrT.PayloadOfErrorKey<M, K>,
    meta?: ErrT.ErrorMeta
  ): Promise<void>;
  fail<K extends ErrT.JoinNsKind<M>>(
    key: K,
    payload: ErrT.PayloadOfErrorKey<M, K>,
    meta?: ErrT.ErrorMeta
  ): Promise<never>;
  once<K extends ErrT.JoinNsKind<M>>(key: K): Promise<ErrT.PayloadOfErrorKey<M, K>>;
  on<K extends ErrT.JoinNsKind<M>>(
    key: K,
    handler: (payload: ErrT.PayloadOfErrorKey<M, K>, meta?: ErrT.ErrorMeta) => void | Promise<void>
  ): Promise<() => void>;
} {
  const call = <T>(key: string, fn: (ns: string, kind: string) => Promise<T>): Promise<T> => {
    const i = key.indexOf('.');
    const ns = i <= 0 ? key : key.slice(0, i);
    const kind = i <= 0 ? '' : key.slice(i + 1);
    return fn(ns, kind);
  };

  async function report<K extends ErrT.JoinNsKind<M>>(
    key: K,
    payload: ErrT.PayloadOfErrorKey<M, K>,
    meta?: ErrT.ErrorMeta
  ): Promise<void> {
    return call<void>(key as string, async (ns, kind) =>
      kernel.errors.namespace(ns).report(kind, payload as unknown, meta)
    );
  }

  async function fail<K extends ErrT.JoinNsKind<M>>(
    key: K,
    payload: ErrT.PayloadOfErrorKey<M, K>,
    meta?: ErrT.ErrorMeta
  ): Promise<never> {
    return call<never>(key as string, async (ns, kind) =>
      kernel.errors.namespace(ns).fail(kind, payload as unknown, meta)
    );
  }

  function once<K extends ErrT.JoinNsKind<M>>(key: K): Promise<ErrT.PayloadOfErrorKey<M, K>> {
    return call<ErrT.PayloadOfErrorKey<M, K>>(
      key as string,
      async (ns, kind) =>
        new Promise<ErrT.PayloadOfErrorKey<M, K>>(resolve => {
          const off = kernel.errors.namespace(ns).on(kind, (p: unknown) => {
            off();
            resolve(p as ErrT.PayloadOfErrorKey<M, K>);
          });
        })
    );
  }

  function on<K extends ErrT.JoinNsKind<M>>(
    key: K,
    handler: (payload: ErrT.PayloadOfErrorKey<M, K>, meta?: ErrT.ErrorMeta) => void | Promise<void>
  ): Promise<() => void> {
    return call<() => void>(key as string, async (ns, kind) =>
      kernel.errors
        .namespace(ns)
        .on(kind, handler as (p: unknown, m?: ErrT.ErrorMeta) => void | Promise<void>)
    );
  }

  return { report, fail, once, on };
}
