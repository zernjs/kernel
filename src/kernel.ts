/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  PluginDefinition,
  PluginContext,
  DeepMerge,
  InferPluginAPI,
  InferPluginAugmentations,
  MiddlewareMap,
  AnyPluginAPI,
} from './types';
import { deepMerge, isObject } from './utils';
import { satisfies } from './semver';

/**
 * Kernel Builder Class
 * Gerencia a configuração e inicialização dos plugins com inferência de tipos.
 */
export class KernelBuilder<Context = {}> {
  private plugins: PluginDefinition<any, any, any, any>[] = [];

  /**
   * Registra um plugin no kernel.
   * A tipagem é acumulada e inferida automaticamente.
   */
  use<P extends PluginDefinition<any, any, any, any>>(
    plugin: P
  ): KernelBuilder<
    DeepMerge<
      DeepMerge<Context, InferPluginAugmentations<P>>,
      { [K in P['name']]: InferPluginAPI<P> }
    >
  > {
    this.plugins.push(plugin);
    return this as any;
  }

  /**
   * Constrói e inicializa o kernel de forma SÍNCRONA.
   * Só funciona se NENHUM plugin retornar Promise no setup.
   * Se algum plugin retornar Promise, lança um erro.
   */
  startSync(): { plugins: Context } {
    const sortedPlugins = sortPluginsTopologically(this.plugins);
    const pluginsMap: Record<string, AnyPluginAPI> = {};

    // Objeto proxy que será passado para os plugins
    // Permite acesso seguro aos plugins já inicializados
    const runtimeContext: PluginContext<any> = {
      plugins: pluginsMap,
    };

    for (const plugin of sortedPlugins) {
      // Executa o setup do plugin SÍNCRONAMENTE
      const result = plugin.setup(runtimeContext);

      if (result instanceof Promise) {
        throw new Error(
          `Plugin '${plugin.name}' returned a Promise in startSync(). Use .start() instead or make the plugin synchronous.`
        );
      }

      this.processPluginResult(plugin, result, pluginsMap);
    }

    return { plugins: pluginsMap as any };
  }

  /**
   * Constrói e inicializa o kernel.
   */
  async start(): Promise<{ plugins: Context }> {
    const sortedPlugins = sortPluginsTopologically(this.plugins);
    const pluginsMap: Record<string, AnyPluginAPI> = {};

    // Objeto proxy que será passado para os plugins
    // Permite acesso seguro aos plugins já inicializados
    const runtimeContext: PluginContext<any> = {
      plugins: pluginsMap,
    };

    for (const plugin of sortedPlugins) {
      // Executa o setup do plugin
      const result = await plugin.setup(runtimeContext);
      this.processPluginResult(plugin, result, pluginsMap);
    }

    return { plugins: pluginsMap as any };
  }

  /**
   * Helper para processar o resultado de um plugin e atualizar o mapa de plugins.
   */
  private processPluginResult(
    plugin: PluginDefinition<any, any, any, any>,
    result: any,
    pluginsMap: Record<string, AnyPluginAPI>
  ): void {
    let api: AnyPluginAPI = result;
    let extensions: Record<string, any> = {};
    let middlewares: MiddlewareMap = {};

    // Verifica se retornou estrutura completa (PluginSetupResult)
    if (isObject(result) && 'api' in result) {
      api = result.api as AnyPluginAPI;
      if ('extensions' in result && result.extensions) {
        extensions = result.extensions as Record<string, any>;
      }
      if ('middlewares' in result && result.middlewares) {
        middlewares = result.middlewares as MiddlewareMap;
      }
    }

    // 1. Registra a API do plugin
    if (!pluginsMap[plugin.name]) {
      pluginsMap[plugin.name] = api;
    } else {
      deepMerge(pluginsMap[plugin.name], api);
    }

    // 2. Aplica extensões (merge profundo de propriedades)
    for (const [targetName, extensionApi] of Object.entries(extensions)) {
      if (pluginsMap[targetName]) {
        deepMerge(pluginsMap[targetName], extensionApi);
      } else {
        pluginsMap[targetName] = extensionApi;
      }
    }

    // 3. Aplica Middlewares (Interceptação de Funções)
    for (const [targetPluginName, methodsMap] of Object.entries(middlewares)) {
      const targetPlugin = pluginsMap[targetPluginName];
      if (!targetPlugin) {
        console.warn(
          `Warning: Middleware target plugin '${targetPluginName}' not found or not yet initialized.`
        );
        continue;
      }

      for (const [methodName, middlewareFn] of Object.entries(methodsMap)) {
        const originalMethod = targetPlugin[methodName];

        if (typeof originalMethod !== 'function') {
          console.warn(
            `Warning: Cannot apply middleware to '${targetPluginName}.${methodName}' because it is not a function.`
          );
          continue;
        }

        // Substitui o método original por um wrapper que chama o middleware
        targetPlugin[methodName] = (...args: any[]) => {
          // O middleware recebe 'next' (o original) e os argumentos
          // Ele decide se chama 'next', com quais argumentos, e o que retorna
          return middlewareFn(originalMethod.bind(targetPlugin), ...args);
        };
      }
    }
  }
}

/**
 * Cria uma nova instância do Kernel Builder.
 */
export function createKernel() {
  return new KernelBuilder();
}

/**
 * Ordenação Topológica Simples com Validação de Versão
 */
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
        // Normaliza a dependência: pode ser objeto ou plugin direto
        let depName: string;
        let requiredRange: string | undefined;

        if ('name' in dep) {
          // É um plugin direto
          depName = dep.name;
        } else {
          // É um objeto de dependência com range
          depName = dep.plugin.name;
          requiredRange = dep.range;
        }

        // Encontra a definição real do plugin na lista de registrados
        const depPlugin = pluginMap.get(depName);

        if (depPlugin) {
          // Validação de Versão (Se um range foi especificado)
          if (requiredRange && depPlugin.version) {
            if (!satisfies(depPlugin.version, requiredRange)) {
              throw new Error(
                `Plugin '${plugin.name}' requires '${depName}' version '${requiredRange}', but found version '${depPlugin.version}'.`
              );
            }
          }

          visit(depPlugin, ancestors);
        } else {
          // Opcional: Permitir dependências implícitas ou lançar erro
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
