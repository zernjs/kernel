/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import {
  PluginDefinition,
  PluginContext,
  AnyPluginAPI,
  DependenciesMap,
  MiddlewaresForContext,
  PluginDependency,
} from './types';

/**
 * Estrutura de retorno do setup que inclui extensões.
 */
export interface PluginSetupResult<
  API extends AnyPluginAPI,
  Extensions extends Record<string, any>,
  // Contexto inferido para middlewares
  DepsContext = {},
> {
  api: API;
  extensions?: Extensions;
  middlewares?: MiddlewaresForContext<DepsContext>;
}

/**
 * Define um novo plugin.
 *
 * @example
 * // Plugin simples
 * const myPlugin = definePlugin({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   setup: () => ({ hello: 'world' })
 * });
 *
 * @example
 * // Plugin com dependências e extensões
 * const extPlugin = definePlugin({
 *   name: 'ext',
 *   version: '1.0.0',
 *   dependencies: [
 *      myPlugin, // Versão implícita (qualquer)
 *      { plugin: otherPlugin, range: '^2.0.0' } // Versão explícita
 *   ],
 *   setup: (ctx) => ({
 *     api: { feature: true },
 *     extensions: {
 *       'my-plugin': { newMethod: () => 'extended' }
 *     }
 *   })
 * });
 */
/**
 * Define um novo plugin.
 *
 * @example
 * // Plugin simples
 * const myPlugin = definePlugin({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   setup: () => ({ hello: 'world' })
 * });
 *
 * @example
 * // Plugin com dependências e extensões
 * const extPlugin = definePlugin({
 *   name: 'ext',
 *   version: '1.0.0',
 *   dependencies: [
 *      myPlugin, // Versão implícita (qualquer)
 *      { plugin: otherPlugin, range: '^2.0.0' } // Versão explícita
 *   ],
 *   setup: (ctx) => ({
 *     api: { feature: true },
 *     extensions: {
 *       'my-plugin': { newMethod: () => 'extended' }
 *     }
 *   })
 * });
 */
export function definePlugin<
  Name extends string,
  Deps extends readonly PluginDependency[] = [],
  API extends AnyPluginAPI = AnyPluginAPI,
  Extensions extends Record<string, any> = {},
>(options: {
  name: Name;
  version: string;
  dependencies?: Deps;
  setup: (
    ctx: PluginContext<DependenciesMap<Deps>>
  ) =>
    | API
    | Promise<API>
    | PluginSetupResult<API, Extensions, DependenciesMap<Deps>>
    | Promise<PluginSetupResult<API, Extensions, DependenciesMap<Deps>>>;
  apiVersions?: Record<
    string,
    (
      ctx: PluginContext<DependenciesMap<Deps>>
    ) =>
      | API
      | Promise<API>
      | PluginSetupResult<API, Extensions, DependenciesMap<Deps>>
      | Promise<PluginSetupResult<API, Extensions, DependenciesMap<Deps>>>
  >;
}): PluginDefinition<Name, API, Extensions, Deps> {
  return {
    name: options.name,
    version: options.version,
    dependencies: options.dependencies,
    setup: options.setup as any,
    apiVersions: options.apiVersions as any,
  } as any;
}
