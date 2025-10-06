/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kernel } from '@/kernel';
import { KernelInitializationError, PluginNotFoundError, ErrorSeverity, solution } from '@/errors';

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
      const error = new PluginNotFoundError({ plugin: pluginName });
      error.context.method = methodName;
      error.severity = ErrorSeverity.ERROR;
      error.solutions = [
        solution(
          'Check the method name',
          `Verify that the method "${methodName}" exists in the ${pluginName} plugin`,
          `const api = kernel.get('${pluginName}');\nconsole.log(Object.keys(api));`
        ),
        solution(
          'Ensure the plugin is properly initialized',
          'The plugin might not have exposed this method in its setup function'
        ),
      ];
      throw error;
    }

    return method(...args);
  };
}
