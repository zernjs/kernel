import { Kernel } from '@/kernel';

// Em @zern/kernel/src/hooks/direct-methods.ts
let globalKernel: Kernel<any> | undefined;

export function setGlobalKernel(kernel: Kernel<any>): void {
  globalKernel = kernel;
}

export function getGlobalKernel(): Kernel<any> {
  if (!globalKernel) {
    throw new Error(
      'Global kernel not initialized. Either call setGlobalKernel(kernel) manually or set autoGlobal: true in createKernel().withConfig({ autoGlobal: true }).'
    );
  }
  return globalKernel;
}

export function createDirectMethod<TPluginName extends string, TMethodName extends string>(
  pluginName: TPluginName,
  methodName: TMethodName
) {
  return (...args: any[]) => {
    const kernel = getGlobalKernel();
    const plugin = kernel.get(pluginName);
    const method = plugin[methodName];

    if (typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found in plugin ${pluginName}`);
    }

    return method(...args);
  };
}
