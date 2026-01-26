/* eslint-disable @typescript-eslint/no-explicit-any */
import { definePlugin } from '../core/plugin';
import { PluginDefinition } from '../core/types';
import { satisfies } from '../utils/semver';

/**
 * Core Dependency Resolver Plugin.
 * Intercepts the kernel initialization to topologically sort plugins based on their dependencies.
 * Also performs semantic version validation for dependencies.
 */
export const CoreDependencyResolverPlugin = definePlugin({
  name: 'core-dependency-resolver',
  version: '1.0.0',
  setup: ctx => {
    ctx.hooks.on('onInit', (kernel: any) => {
      const plugins = kernel.getPlugins();
      const sorted = sortPluginsTopologically(plugins);
      kernel.setPlugins(sorted);
    });

    return {};
  },
});

function sortPluginsTopologically(
  plugins: PluginDefinition<any, any, any, any>[]
): PluginDefinition<any, any, any, any>[] {
  const visited = new Set<string>();
  const sorted: PluginDefinition<any, any, any, any>[] = [];
  const pluginMap = new Map(plugins.map(p => [p.name, p]));

  function visit(
    plugin: PluginDefinition<any, any, any, any>,
    ancestors: Set<string> = new Set()
  ): void {
    if (visited.has(plugin.name)) return;
    if (ancestors.has(plugin.name)) {
      throw new Error(
        `Circular dependency detected: ${Array.from(ancestors).join(' -> ')} -> ${plugin.name}`
      );
    }

    ancestors.add(plugin.name);

    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        let depName: string;
        let requiredRange: string | undefined;

        if ('name' in dep) {
          depName = dep.name;
        } else {
          depName = dep.plugin.name;
          requiredRange = dep.range;
        }

        const depPlugin = pluginMap.get(depName);

        if (depPlugin) {
          if (requiredRange && depPlugin.version) {
            if (!satisfies(depPlugin.version, requiredRange)) {
              throw new Error(
                `Plugin '${plugin.name}' requires '${depName}' version '${requiredRange}', but found version '${depPlugin.version}'.`
              );
            }
          }
          visit(depPlugin, ancestors);
        } else {
          console.warn(
            `Warning: Plugin '${plugin.name}' depends on '${depName}' which was not added to the kernel.`
          );
        }
      }
    }

    ancestors.delete(plugin.name);
    visited.add(plugin.name);
    sorted.push(plugin);
  }

  plugins.forEach(p => visit(p));
  return sorted;
}
