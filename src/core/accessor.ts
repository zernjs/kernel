/**
 * @file Creates a typed accessor over the plugin registry with proxy ergonomics.
 */
import type { IPluginRegistry, PluginInstance, PluginAccessor } from '@types';
import { hasOwn } from '@utils';

type PropKey = string | symbol;

function getOwnProperty(target: object, prop: PropKey): unknown {
  return (target as unknown as Record<string, unknown>)[prop as string];
}

function getFromRegistry<TPlugins extends Record<string, PluginInstance>>(
  registry: IPluginRegistry,
  prop: PropKey
): TPlugins[keyof TPlugins] | undefined {
  if (typeof prop === 'string') return registry.get(prop) as unknown as TPlugins[keyof TPlugins];
  return undefined;
}

function hasOwnProperty(base: object, registry: IPluginRegistry, prop: PropKey): boolean {
  if (typeof prop !== 'symbol' && hasOwn(base as object, prop)) return true;
  if (typeof prop === 'string') return registry.has(prop);
  return false;
}

function listProxyKeys(registry: IPluginRegistry): (string | symbol)[] {
  const names = registry.list().map(p => p.metadata.name);
  const methods = ['register', 'has', 'list', 'getLoadOrder', 'clear'];
  return [...methods, ...names];
}

export function createPluginAccessor<TPlugins extends Record<string, PluginInstance>>(
  registry: IPluginRegistry
): PluginAccessor<TPlugins> {
  const base: Pick<
    PluginAccessor<TPlugins>,
    'register' | 'has' | 'list' | 'getLoadOrder' | 'clear'
  > = {
    register: registry.register.bind(registry) as PluginAccessor<TPlugins>['register'],
    has: registry.has.bind(registry) as PluginAccessor<TPlugins>['has'],
    list: registry.list.bind(registry) as PluginAccessor<TPlugins>['list'],
    getLoadOrder: registry.getLoadOrder.bind(registry) as PluginAccessor<TPlugins>['getLoadOrder'],
    clear: registry.clear.bind(registry) as PluginAccessor<TPlugins>['clear'],
  };

  return new Proxy(base as unknown as PluginAccessor<TPlugins>, {
    get(target, prop: PropKey): unknown {
      if (typeof prop !== 'symbol' && hasOwn(target as object, prop))
        return getOwnProperty(target, prop);
      return getFromRegistry<TPlugins>(registry, prop);
    },
    has(_target, prop: PropKey): boolean {
      return hasOwnProperty(base as object, registry, prop);
    },
    ownKeys(): (string | symbol)[] {
      return listProxyKeys(registry);
    },
  });
}
