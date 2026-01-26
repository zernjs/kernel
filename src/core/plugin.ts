/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import {
  PluginDefinition,
  PluginContext,
  AnyPluginAPI,
  DependenciesMap,
  PluginSetupResult,
  PluginDependency,
  HooksForContext,
} from './types';

/**
 * Defines a new plugin for the Zern Kernel.
 * This helper function ensures proper type inference for dependencies, API, extensions, and hooks.
 *
 * @param options - The plugin configuration object.
 * @returns A strictly typed PluginDefinition object.
 *
 * @example
 * // Simple Plugin
 * const myPlugin = definePlugin({
 *   name: 'my-plugin',
 *   version: '1.0.0',
 *   setup: () => ({ hello: 'world' })
 * });
 *
 * @example
 * // Complex Plugin with dependencies, extensions, and custom hooks
 * const extPlugin = definePlugin({
 *   name: 'ext',
 *   version: '1.0.0',
 *   dependencies: [
 *      myPlugin, // Implicit version
 *      { plugin: otherPlugin, range: '^2.0.0' } // Explicit version
 *   ],
 *   // Define custom hooks that this plugin emits
 *   events: {} as {
 *     'onCustomEvent': (payload: string) => void
 *   },
 *   setup: (ctx) => {
 *     // ctx.hooks is typed with CoreHooks + DependencyHooks + ProvidedHooks
 *     ctx.hooks.emitSync('onCustomEvent', 'test');
 *     return {
 *       api: { feature: true },
 *       extensions: {
 *         'my-plugin': { newMethod: () => 'extended' }
 *       }
 *     };
 *   }
 * });
 */
export function definePlugin<
  Name extends string,
  Deps extends readonly PluginDependency[] = [],
  API extends AnyPluginAPI = AnyPluginAPI,
  Extensions extends Record<string, any> = {},
  ProvidedHooks = {},
>(options: {
  name: Name;
  version: string;
  dependencies?: Deps;
  // Optional property to infer provided hooks type
  events?: ProvidedHooks;
  setup: (
    ctx: PluginContext<DependenciesMap<Deps>, HooksForContext<Deps> & ProvidedHooks>
  ) =>
    | API
    | Promise<API>
    | PluginSetupResult<API, Extensions, DependenciesMap<Deps>>
    | Promise<PluginSetupResult<API, Extensions, DependenciesMap<Deps>>>;
  apiVersions?: Record<
    string,
    (
      ctx: PluginContext<DependenciesMap<Deps>, HooksForContext<Deps> & ProvidedHooks>
    ) =>
      | API
      | Promise<API>
      | PluginSetupResult<API, Extensions, DependenciesMap<Deps>>
      | Promise<PluginSetupResult<API, Extensions, DependenciesMap<Deps>>>
  >;
}): PluginDefinition<Name, API, Extensions, Deps, ProvidedHooks> {
  return {
    name: options.name,
    version: options.version,
    dependencies: options.dependencies,
    setup: options.setup as any,
    apiVersions: options.apiVersions as any,
  } as any;
}
