/**
 * @file Plugin system main module
 * @description Re-exports all plugin system components
 * @deprecated This file now re-exports from modular files. Use direct imports from specific files instead.
 */

export type { PluginSetupContext, BuiltPlugin, PluginBuilder } from './types';

export { plugin } from './factory';

export { PluginBuilderImpl } from './builder';
export { BuiltPluginImpl } from './built-plugin';
