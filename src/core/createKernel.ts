/**
 * @file Factory for Kernel and its builder with typed plugins and augments.
 */
import { KernelBuilder } from '@core/builder';
import type { PluginInstance } from '@types';
export { Kernel } from '@core/kernel';

/**
 * Creates a typed Kernel builder.
 * @returns KernelBuilder instance.
 */
export function createKernel<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
>(): KernelBuilder<TPlugins, TAugments> {
  return new KernelBuilder<TPlugins, TAugments>();
}

export { KernelBuilder };
