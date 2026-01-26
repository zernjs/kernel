/* eslint-disable @typescript-eslint/no-explicit-any */

import { definePlugin } from '../core/plugin';
import { AnyPluginAPI, MiddlewareMap, PluginDefinition } from '../core/types';
import { deepMerge, isObject } from '../utils';

/**
 * Core Middleware Plugin.
 * Intercepts plugin initialization to apply middlewares, register APIs, and handle extensions.
 * Ensures that all plugin capabilities are correctly merged into the runtime context.
 */
export const CoreMiddlewarePlugin = definePlugin({
  name: 'core-middleware',
  version: '1.0.0',
  setup: ctx => {
    ctx.hooks.on(
      'onPluginReady',
      (
        plugin: PluginDefinition<any, any, any, any>,
        result: any,
        pluginsMap: Record<string, AnyPluginAPI>
      ) => {
        let api: AnyPluginAPI = result;
        let extensions: Record<string, any> = {};
        let middlewares: MiddlewareMap = {};

        if (isObject(result) && 'api' in result) {
          api = result.api as AnyPluginAPI;
          if ('extensions' in result && result.extensions) {
            extensions = result.extensions as Record<string, any>;
          }
          if ('middlewares' in result && result.middlewares) {
            middlewares = result.middlewares as MiddlewareMap;
          }
        }

        if (!pluginsMap[plugin.name]) {
          pluginsMap[plugin.name] = api;
        } else {
          deepMerge(pluginsMap[plugin.name], api);
        }

        for (const [targetName, extensionApi] of Object.entries(extensions)) {
          if (pluginsMap[targetName]) {
            deepMerge(pluginsMap[targetName], extensionApi);
          } else {
            pluginsMap[targetName] = extensionApi;
          }
        }

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

            targetPlugin[methodName] = (...args: any[]): any => {
              try {
                return middlewareFn(originalMethod.bind(targetPlugin), ...args);
              } catch (error) {
                console.error(
                  `[CoreMiddleware] Error in middleware for '${targetPluginName}.${methodName}':`,
                  error
                );
                throw error;
              }
            };
          }
        }
      }
    );

    return {};
  },
});
