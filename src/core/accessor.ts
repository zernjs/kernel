import type { IPluginRegistry, PluginInstance, PluginAccessor } from '@types';
import { hasOwn } from '@utils';

// PluginAccessor type moved to core/types.ts to centralize layer types

export function createPluginAccessor<TPlugins extends Record<string, PluginInstance>>(
  registry: IPluginRegistry
): PluginAccessor<TPlugins> {
  const base: Pick<
    PluginAccessor<TPlugins>,
    'get' | 'register' | 'has' | 'list' | 'getLoadOrder' | 'clear'
  > = {
    get: registry.get.bind(registry) as PluginAccessor<TPlugins>['get'],
    register: registry.register.bind(registry) as PluginAccessor<TPlugins>['register'],
    has: registry.has.bind(registry) as PluginAccessor<TPlugins>['has'],
    list: registry.list.bind(registry) as PluginAccessor<TPlugins>['list'],
    getLoadOrder: registry.getLoadOrder.bind(registry) as PluginAccessor<TPlugins>['getLoadOrder'],
    clear: registry.clear.bind(registry) as PluginAccessor<TPlugins>['clear'],
  };

  return new Proxy(base as PluginAccessor<TPlugins>, {
    get(target, prop: string | symbol): unknown {
      if (typeof prop !== 'symbol' && hasOwn(target as object, prop))
        return (target as unknown as Record<string, unknown>)[prop];
      if (typeof prop === 'string')
        return registry.get(prop) as unknown as TPlugins[keyof TPlugins];
      return undefined;
    },
    has(_target, prop: string | symbol): boolean {
      if (typeof prop !== 'symbol' && hasOwn(base as object, prop)) return true;
      if (typeof prop === 'string') return registry.has(prop);
      return false;
    },
    ownKeys(): (string | symbol)[] {
      const names = registry.list().map(p => p.metadata.name);
      const methods = ['get', 'register', 'has', 'list', 'getLoadOrder', 'clear'];
      return [...methods, ...names];
    },
  });
}
