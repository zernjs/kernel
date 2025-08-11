/**
 * @file Library root and DX helpers.
 * @module zern-kernel
 * @remarks
 * Exposes all Kernel layers via named namespaces (e.g., `events`, `hooks`, `errors`),
 * and provides small ergonomic helpers that transparently initialize a global Kernel
 * the first time they are used. This lets consumers import a feature and start
 * using it immediately without manual bootstrapping.
 *
 * - Namespaced re-exports: `core`, `plugin`, `events`, `hooks`, `errors`, `alerts`,
 *   `lifecycle`, `resolver`, `diagnostics`, `utils`, `types`.
 * - Global Kernel helpers: {@link getKernel}, {@link ensureKernel}, {@link withKernel}.
 * - Layer helpers: {@link useEvents}, {@link useHooks}, {@link useErrors}, {@link useAlerts}.
 * - Convenience emitters: {@link emitEvent}, {@link emitHook}.
 */
export * as core from './core';
export * as alerts from './alerts';
export * as diagnostics from './diagnostics';
export * as errors from './errors';
export * as events from './events';
export * as hooks from './hooks';
export * as lifecycle from './lifecycle';
export * as plugin from './plugin';
export * as resolver from './resolve';
export * as types from './types';
export * as utils from './utils';

import { createKernel } from './core/createKernel';
import type { Kernel } from './core/kernel';
import { bindEvents } from './events/event-bus';
import type { EventBus } from './events/event-bus';
import type { event as eventFactory } from './events/event-bus';

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
 * await kernel.events.namespace('auth').emit('login', { userId: 'u1' });
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
 * Layer accessors: import and use directly; Kernel is ensured behind the scenes.
 */
/**
 * Resolve the global {@link Kernel} instance (ensuring initialization when necessary).
 * @returns Initialized {@link Kernel}.
 */
export async function useKernel(): Promise<Kernel> {
  return await ensureKernel();
}

/**
 * Get the Events bus from the global Kernel.
 * @returns Kernel.events
 * @example
 * ```ts
 * import { useEvents } from '@zern/kernel';
 * const events = await useEvents();
 * const created = events.namespace('user').define<{ id: string }>('created');
 * await created.emit({ id: 'u1' });
 * ```
 */

/* eslint-disable no-redeclare */
export async function useEvents(): Promise<Kernel['events']>;
export async function useEvents<
  TSpec extends Record<string, ReturnType<typeof eventFactory<unknown>>>,
>(descriptor: {
  namespace: string;
  spec: TSpec;
}): Promise<{
  emit: <K extends keyof TSpec & string>(
    event: K,
    payload: TSpec[K] extends { __payload?: infer P } ? P : unknown
  ) => Promise<void>;
  on: <K extends keyof TSpec & string>(
    event: K,
    handler: (
      payload: TSpec[K] extends { __payload?: infer P } ? P : unknown
    ) => void | Promise<void>
  ) => () => void;
}>;
export async function useEvents<
  TSpec extends Record<string, ReturnType<typeof eventFactory<unknown>>>,
>(descriptor?: {
  namespace: string;
  spec: TSpec;
}): Promise<
  | Kernel['events']
  | {
      emit: <K extends keyof TSpec & string>(
        event: K,
        payload: TSpec[K] extends { __payload?: infer P } ? P : unknown
      ) => Promise<void>;
      on: <K extends keyof TSpec & string>(
        event: K,
        handler: (
          payload: TSpec[K] extends { __payload?: infer P } ? P : unknown
        ) => void | Promise<void>
      ) => () => void;
    }
> {
  const k = await withKernel(kernel => kernel);
  if (descriptor) {
    return bindEvents(k.events as unknown as EventBus, descriptor) as unknown as Promise<{
      emit: <K extends keyof TSpec & string>(
        event: K,
        payload: TSpec[K] extends { __payload?: infer P } ? P : unknown
      ) => Promise<void>;
      on: <K extends keyof TSpec & string>(
        event: K,
        handler: (
          payload: TSpec[K] extends { __payload?: infer P } ? P : unknown
        ) => void | Promise<void>
      ) => () => void;
    }>;
  }
  return k.events;
}
/* eslint-enable no-redeclare */

/**
 * Get the Hooks bus from the global Kernel.
 * @returns Kernel.hooks
 */
export async function useHooks(): Promise<Kernel['hooks']> {
  return await withKernel(k => k.hooks);
}

/**
 * Get the ErrorBus from the global Kernel.
 * @returns Kernel.errors
 */
export async function useErrors(): Promise<Kernel['errors']> {
  return await withKernel(k => k.errors);
}

/**
 * Get the AlertBus from the global Kernel.
 * @returns Kernel.alerts
 */
export async function useAlerts(): Promise<Kernel['alerts']> {
  return await withKernel(k => k.alerts);
}

/** Convenience one-liners */
/**
 * Emit an event through the global Kernel's Events bus, creating the event on-demand.
 * @typeParam Payload - Event payload type.
 * @param namespace - Namespace that groups related events.
 * @param name - Event name within the namespace.
 * @param payload - Payload to emit to subscribers.
 * @returns Promise that resolves once handlers and adapters are scheduled.
 */
export async function emitEvent<Payload>(
  namespace: string,
  name: string,
  payload: Payload
): Promise<void> {
  const bus = (await useEvents()) as unknown as EventBus;
  await bus.namespace(namespace).emit(name as string, payload as unknown);
}

/**
 * Emit a hook through the global Kernel's Hooks bus, creating the hook on-demand.
 * @typeParam Payload - Hook payload type.
 * @param name - Hook name.
 * @param payload - Payload delivered to hook handlers.
 * @returns Promise that resolves once all hook handlers finish.
 */
export async function emitHook<Payload>(name: string, payload: Payload): Promise<void> {
  const hb = await useHooks();
  const hk = hb.define<Payload>(name as string);
  await hk.emit(payload);
}
