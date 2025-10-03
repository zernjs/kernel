import { Kernel } from '@/kernel';
import { KernelInitializationError } from '@/core';

// Global kernel instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let globalKernel: any = undefined;

export function setGlobalKernel<TPlugins>(kernel: Kernel<TPlugins>): void {
  globalKernel = kernel;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGlobalKernel(): any {
  if (!globalKernel) {
    throw new KernelInitializationError();
  }
  return globalKernel;
}

export function createDirectMethod<TPluginName extends string, TMethodName extends string>(
  pluginName: TPluginName,
  methodName: TMethodName
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (...args: any[]) => any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
