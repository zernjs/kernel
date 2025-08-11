/**
 * @file Factory for Kernel and its builder with typed plugins and augments.
 */
import { KernelBuilder } from '@core/builder';
import type { PluginInstance } from '@types';
import type { EventDef } from '@events/types';
export { Kernel } from '@core/kernel';

/**
 * Creates a typed Kernel builder.
 * @returns KernelBuilder instance.
 */
export function createKernel<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
  TEventMap extends Record<string, Record<string, EventDef>> = Record<never, never>,
>(): KernelBuilder<TPlugins, TAugments, TEventMap> {
  return new KernelBuilder<TPlugins, TAugments, TEventMap>();
}

export { KernelBuilder };
