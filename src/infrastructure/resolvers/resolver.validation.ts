/**
 * @file Resolver Validation Utilities
 * Contains validation logic for plugin configurations and dependencies.
 */

import { parseVersion, parseConstraint } from '../../shared/utils/version.utils.js';
import type { PluginEntry } from './resolver.types.js';

/**
 * Validates a plugin configuration before resolution.
 * @param plugins - Plugins to validate
 * @returns Array of validation errors
 */
export function validatePlugins(plugins: Map<string, PluginEntry>): readonly string[] {
  const errors: string[] = [];

  for (const [name, entry] of Array.from(plugins)) {
    const plugin = entry.plugin;

    // Validate plugin name consistency
    if (plugin.name !== name) {
      errors.push(
        `Plugin name mismatch: registered as '${name}' but plugin.name is '${plugin.name}'`
      );
    }

    // Validate version format
    try {
      parseVersion(plugin.version);
    } catch (error) {
      errors.push(`Invalid version '${plugin.version}' for plugin '${name}': ${error}`);
    }

    // Validate dependency constraints
    for (const dependency of plugin.dependencies) {
      if (dependency.versionConstraint) {
        try {
          // Parse and validate constraint
          const parsedConstraint = parseConstraint(dependency.versionConstraint);
          if (!parsedConstraint.version) {
            throw new Error('Invalid version constraint');
          }
        } catch (error) {
          errors.push(
            `Invalid version constraint '${dependency.versionConstraint}' in plugin '${name}': ${error}`
          );
        }
      }
    }
  }

  return errors;
}
