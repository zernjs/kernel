/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kernel } from '@/kernel';
import { KernelInitializationError } from '@/core';

let globalKernel: any = undefined;

export function setGlobalKernel<TPlugins>(kernel: Kernel<TPlugins>): void {
  globalKernel = kernel;
}

export function getGlobalKernel(): any {
  if (!globalKernel) {
    throw new KernelInitializationError();
  }
  return globalKernel;
}

export function createDirectMethod<TPluginName extends string, TMethodName extends string>(
  pluginName: TPluginName,
  methodName: TMethodName
): (...args: any[]) => any {
  return (...args: any[]): any => {
    const kernel = getGlobalKernel();
    const plugin = kernel.get(pluginName);
    const method = plugin[methodName];

    if (typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found in plugin ${pluginName}`);
    }

    return method(...args);
  };
}
