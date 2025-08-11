/**
 * @file Factory for Kernel and its builder with typed plugins and augments.
 */
import { KernelBuilder } from '@core/builder';
import type { PluginInstance } from '@types';
import type { EventDef } from '@events/types';
import type { AlertDef } from '@alerts/types';
export { Kernel } from '@core/kernel';

/**
 * Creates a typed Kernel builder.
 * @returns KernelBuilder instance.
 */
export function createKernel<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
  TEventMap extends Record<string, Record<string, EventDef>> = Record<never, never>,
  TAlertMap extends Record<string, Record<string, AlertDef>> = Record<never, never>,
>(): KernelBuilder<TPlugins, TAugments, TEventMap, TAlertMap> {
  return new KernelBuilder<TPlugins, TAugments, TEventMap, TAlertMap>();
}

export { KernelBuilder };
