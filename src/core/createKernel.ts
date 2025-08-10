import { KernelBuilder } from '@core/builder';
import type { PluginInstance } from '@types';
export { Kernel } from '@core/kernel';

export function createKernel<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
>(): KernelBuilder<TPlugins, TAugments> {
  return new KernelBuilder<TPlugins, TAugments>();
}

export { KernelBuilder };
