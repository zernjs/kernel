/**
 * @file Version resolution for dependency management.
 * Handles semantic version constraints and conflict detection.
 */

import type { Version } from '../../shared/types/common.types.js';
import { createPluginId } from '../../shared/types/common.types.js';
import type {
  VersionConstraint,
  DependencyConflict,
} from '../../domain/dependency/dependency.types.js';
import { ConflictType } from '../../domain/dependency/dependency.types.js';
import { satisfiesRange, getLatestVersion } from '../../shared/utils/version.utils.js';
import { createVersion as makeVersion } from '../../shared/types/common.types.js';

/**
 * Version requirement for a plugin dependency.
 */
export interface VersionRequirement {
  readonly plugin: string;
  readonly constraint: VersionConstraint;
  readonly requiredBy: string;
  readonly optional: boolean;
}

/**
 * Result of version resolution for a plugin.
 */
export interface VersionResolution {
  readonly plugin: string;
  readonly resolvedVersion: Version;
  readonly availableVersions: readonly Version[];
  readonly satisfiedRequirements: readonly VersionRequirement[];
  readonly conflicts: readonly DependencyConflict[];
}

/**
 * Version resolver for managing plugin version constraints.
 */
export class VersionResolver {
  private readonly requirements = new Map<string, VersionRequirement[]>();
  private readonly availableVersions = new Map<string, Version[]>();

  /**
   * Adds a version requirement for a plugin.
   * @param requirement - Version requirement to add
   */
  addRequirement(requirement: VersionRequirement): void {
    const existing = this.requirements.get(requirement.plugin) || [];
    existing.push(requirement);
    this.requirements.set(requirement.plugin, existing);
  }

  /**
   * Sets available versions for a plugin.
   * @param plugin - Plugin name
   * @param versions - Available version strings
   */
  setAvailableVersions(plugin: string, versions: readonly string[]): void {
    const parsedVersions = versions.map(v => {
      try {
        return makeVersion(v);
      } catch (_error) {
        throw new Error(`Invalid version '${v}' for plugin '${plugin}': ${_error}`);
      }
    });

    this.availableVersions.set(plugin, parsedVersions);
  }

  /**
   * Resolves versions for all plugins with requirements.
   * @returns Map of plugin names to their version resolutions
   */
  resolveVersions(): Map<string, VersionResolution> {
    const resolutions = new Map<string, VersionResolution>();

    for (const [plugin, requirements] of Array.from(this.requirements)) {
      const resolution = this.resolvePluginVersion(plugin, requirements);
      resolutions.set(plugin, resolution);
    }

    return resolutions;
  }

  /**
   * Checks for version conflicts across all plugins.
   * @returns Array of detected conflicts
   */
  detectConflicts(): readonly DependencyConflict[] {
    const conflicts: DependencyConflict[] = [];
    const resolutions = this.resolveVersions();

    for (const [, resolution] of Array.from(resolutions)) {
      conflicts.push(...resolution.conflicts);
    }

    return conflicts;
  }

  /**
   * Gets the best version for a plugin given its requirements.
   * @param plugin - Plugin name
   * @returns Best version or undefined if no suitable version found
   */
  getBestVersion(plugin: string): Version | undefined {
    const requirements = this.requirements.get(plugin) || [];
    const availableVersions = this.availableVersions.get(plugin) || [];

    if (availableVersions.length === 0) {
      return undefined;
    }

    // If no requirements, return the highest available version
    if (requirements.length === 0) {
      const latest = getLatestVersion(availableVersions);
      return latest === null ? undefined : latest;
    }

    // Find versions that satisfy all requirements
    const satisfyingVersions = availableVersions.filter(version => {
      return requirements.every(req => {
        try {
          return satisfiesRange(
            version,
            req.constraint.raw || `${req.constraint.operator}${req.constraint.version}`
          );
        } catch {
          return false;
        }
      });
    });

    const latest = getLatestVersion(satisfyingVersions);
    return latest === null ? undefined : latest;
  }

  /**
   * Checks if a specific version satisfies all requirements for a plugin.
   * @param plugin - Plugin name
   * @param version - Version to check
   * @returns True if version satisfies all requirements
   */
  satisfiesAllRequirements(plugin: string, version: Version): boolean {
    const requirements = this.requirements.get(plugin) || [];

    return requirements.every(req => {
      try {
        return satisfiesRange(
          version,
          req.constraint.raw || `${req.constraint.operator}${req.constraint.version}`
        );
      } catch {
        return false;
      }
    });
  }

  /**
   * Gets all requirements for a specific plugin.
   * @param plugin - Plugin name
   * @returns Array of version requirements
   */
  getRequirements(plugin: string): readonly VersionRequirement[] {
    return this.requirements.get(plugin) || [];
  }

  /**
   * Gets available versions for a specific plugin.
   * @param plugin - Plugin name
   * @returns Array of available versions
   */
  getAvailableVersions(plugin: string): readonly Version[] {
    return this.availableVersions.get(plugin) || [];
  }

  /**
   * Clears all requirements and available versions.
   */
  clear(): void {
    this.requirements.clear();
    this.availableVersions.clear();
  }

  /**
   * Resolves the version for a specific plugin.
   * @param plugin - Plugin name
   * @param requirements - Version requirements for the plugin
   * @returns Version resolution result
   */
  private resolvePluginVersion(
    plugin: string,
    requirements: readonly VersionRequirement[]
  ): VersionResolution {
    const availableVersions = this.availableVersions.get(plugin) || [];
    const conflicts: DependencyConflict[] = [];
    const satisfiedRequirements: VersionRequirement[] = [];

    // Check if plugin has any available versions
    if (availableVersions.length === 0) {
      const requiredBy = requirements.map(r => r.requiredBy);
      conflicts.push({
        type: ConflictType.MISSING_DEPENDENCY,
        pluginId: createPluginId(plugin),
        dependencyId: createPluginId(requirements[0]?.requiredBy || 'unknown'),
        description: `Plugin '${plugin}' is required but not available`,
        severity: 'error' as const,
        suggestedResolution: `Install plugin '${plugin}' or make the dependency optional`,
        conflictingPlugins: [createPluginId(plugin), ...requiredBy.map(createPluginId)],
        details: {
          required: requirements.map(r => r.constraint.raw).join(', '),
          found: 'none',
        },
      });

      return {
        plugin,
        resolvedVersion: makeVersion('0.0.0'), // Placeholder
        availableVersions: [],
        satisfiedRequirements: [],
        conflicts,
      };
    }

    // Find the best version that satisfies all requirements
    const bestVersion = this.getBestVersion(plugin);

    if (!bestVersion) {
      // No version satisfies all requirements
      // Find conflicting requirements for debugging
      this.findConflictingRequirements(plugin, requirements);

      conflicts.push({
        type: ConflictType.VERSION_MISMATCH,
        pluginId: createPluginId(plugin),
        dependencyId: createPluginId(requirements[0]?.requiredBy || 'unknown'),
        description: `No version of '${plugin}' satisfies all requirements`,
        severity: 'error' as const,
        suggestedResolution: 'Update version constraints to be compatible',
        conflictingPlugins: [
          createPluginId(plugin),
          ...requirements.map(r => createPluginId(r.requiredBy)),
        ],
        details: {
          required: requirements.map(r => `${r.constraint.raw} (by ${r.requiredBy})`).join(', '),
          found: availableVersions.join(', '),
        },
      });

      return {
        plugin,
        resolvedVersion: availableVersions[0], // Use first available as fallback
        availableVersions,
        satisfiedRequirements: [],
        conflicts,
      };
    }

    // Check which requirements are satisfied by the best version
    for (const requirement of requirements) {
      try {
        if (
          satisfiesRange(
            bestVersion,
            requirement.constraint.raw ||
              `${requirement.constraint.operator}${requirement.constraint.version}`
          )
        ) {
          satisfiedRequirements.push(requirement);
        }
      } catch {
        conflicts.push({
          type: ConflictType.VERSION_MISMATCH,
          pluginId: createPluginId(plugin),
          dependencyId: createPluginId(requirement.requiredBy),
          description: `Invalid version constraint '${requirement.constraint.raw}' for plugin '${plugin}'`,
          severity: 'error' as const,
          suggestedResolution: 'Fix the version constraint format',
          details: {
            required: requirement.constraint.raw,
            found: bestVersion,
          },
        });
      }
    }

    return {
      plugin,
      resolvedVersion: bestVersion,
      availableVersions,
      satisfiedRequirements,
      conflicts,
    };
  }

  /**
   * Finds conflicting requirements for a plugin.
   * @param plugin - Plugin name
   * @param requirements - All requirements for the plugin
   * @returns Array of conflicting requirement pairs
   */
  private findConflictingRequirements(
    plugin: string,
    requirements: readonly VersionRequirement[]
  ): Array<[VersionRequirement, VersionRequirement]> {
    const conflicts: Array<[VersionRequirement, VersionRequirement]> = [];
    const availableVersions = this.availableVersions.get(plugin) || [];

    for (let i = 0; i < requirements.length; i++) {
      for (let j = i + 1; j < requirements.length; j++) {
        const req1 = requirements[i];
        const req2 = requirements[j];

        // Check if any available version satisfies both requirements
        const hasCompatibleVersion = availableVersions.some(version => {
          try {
            return (
              satisfiesRange(
                version,
                req1.constraint.raw || `${req1.constraint.operator}${req1.constraint.version}`
              ) &&
              satisfiesRange(
                version,
                req2.constraint.raw || `${req2.constraint.operator}${req2.constraint.version}`
              )
            );
          } catch {
            return false;
          }
        });

        if (!hasCompatibleVersion) {
          conflicts.push([req1, req2]);
        }
      }
    }

    return conflicts;
  }
}
