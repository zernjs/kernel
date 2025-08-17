/**
 * @file Version parsing and comparison utilities.
 * Provides semantic version handling following semver specification.
 */

import type { SemVer, VersionConstraint } from '../types.js';

// Re-export types for external use
export type { SemVer, VersionConstraint } from '../types.js';

/**
 * Regular expression for parsing semantic versions.
 * Supports major.minor.patch with optional prerelease and build metadata.
 */
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Regular expression for parsing version constraints.
 * Supports operators: ^, ~, >=, <=, >, <, =
 */
const CONSTRAINT_REGEX = /^(\^|~|>=|<=|>|<|=)?(.+)$/;

/**
 * Parses a semantic version string into a SemVer object.
 * @param version - Version string to parse
 * @returns Parsed semantic version
 * @throws {Error} If version format is invalid
 */
export function parseVersion(version: string): SemVer {
  if (!version || typeof version !== 'string') {
    throw new Error('Version must be a non-empty string');
  }

  const match = version.trim().match(SEMVER_REGEX);
  if (!match) {
    throw new Error(`Invalid semantic version format: ${version}`);
  }

  const [, major, minor, patch, prerelease, build] = match;

  return {
    major: parseInt(major, 10),
    minor: parseInt(minor, 10),
    patch: parseInt(patch, 10),
    prerelease: prerelease || undefined,
    build: build || undefined,
  };
}

/**
 * Parses a version constraint string.
 * @param constraint - Constraint string (e.g., "^1.2.3", ">=2.0.0")
 * @returns Parsed version constraint
 * @throws {Error} If constraint format is invalid
 */
export function parseConstraint(constraint: string): VersionConstraint {
  if (!constraint || typeof constraint !== 'string') {
    throw new Error('Constraint must be a non-empty string');
  }

  const trimmed = constraint.trim();
  const match = trimmed.match(CONSTRAINT_REGEX);

  if (!match) {
    throw new Error(`Invalid version constraint format: ${constraint}`);
  }

  const [, operator = '', versionPart] = match;
  const version = parseVersion(versionPart);

  return {
    operator: operator as VersionConstraint['operator'],
    version,
    raw: trimmed,
  };
}

/**
 * Compares two semantic versions.
 * @param a - First version
 * @param b - Second version
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: SemVer, b: SemVer): number {
  // Compare major version
  if (a.major !== b.major) {
    return a.major - b.major;
  }

  // Compare minor version
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }

  // Compare patch version
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }

  // Compare prerelease versions
  if (a.prerelease && !b.prerelease) {
    return -1; // Prerelease versions have lower precedence
  }

  if (!a.prerelease && b.prerelease) {
    return 1;
  }

  if (a.prerelease && b.prerelease) {
    return comparePrerelease(a.prerelease, b.prerelease);
  }

  return 0;
}

/**
 * Checks if a version satisfies a constraint.
 * @param version - Version to check
 * @param constraint - Constraint to satisfy
 * @returns True if version satisfies constraint
 */
export function satisfiesConstraint(version: SemVer, constraint: VersionConstraint): boolean {
  const comparison = compareVersions(version, constraint.version);

  switch (constraint.operator) {
    case '^':
      return satisfiesCaretRange(version, constraint.version);
    case '~':
      return satisfiesTildeRange(version, constraint.version);
    case '>=':
      return comparison >= 0;
    case '<=':
      return comparison <= 0;
    case '>':
      return comparison > 0;
    case '<':
      return comparison < 0;
    case '=':
    case '':
      return comparison === 0;
    default:
      throw new Error(`Unsupported constraint operator: ${constraint.operator}`);
  }
}

/**
 * Checks if version satisfies caret range (^1.2.3 allows >=1.2.3 <2.0.0).
 * @param version - Version to check
 * @param base - Base version for range
 * @returns True if version is in caret range
 */
function satisfiesCaretRange(version: SemVer, base: SemVer): boolean {
  if (version.major !== base.major) {
    return false;
  }

  const comparison = compareVersions(version, base);
  return comparison >= 0;
}

/**
 * Checks if version satisfies tilde range (~1.2.3 allows >=1.2.3 <1.3.0).
 * @param version - Version to check
 * @param base - Base version for range
 * @returns True if version is in tilde range
 */
function satisfiesTildeRange(version: SemVer, base: SemVer): boolean {
  if (version.major !== base.major || version.minor !== base.minor) {
    return false;
  }

  const comparison = compareVersions(version, base);
  return comparison >= 0;
}

/**
 * Compares prerelease version strings.
 * @param a - First prerelease string
 * @param b - Second prerelease string
 * @returns Comparison result
 */
function comparePrerelease(a: string, b: string): number {
  const aParts = a.split('.');
  const bParts = b.split('.');
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];

    if (aPart === undefined) {
      return -1;
    }

    if (bPart === undefined) {
      return 1;
    }

    const aIsNumeric = /^\d+$/.test(aPart);
    const bIsNumeric = /^\d+$/.test(bPart);

    if (aIsNumeric && bIsNumeric) {
      const diff = parseInt(aPart, 10) - parseInt(bPart, 10);
      if (diff !== 0) {
        return diff;
      }
    } else if (aIsNumeric) {
      return -1; // Numeric identifiers have lower precedence
    } else if (bIsNumeric) {
      return 1;
    } else {
      const diff = aPart.localeCompare(bPart);
      if (diff !== 0) {
        return diff;
      }
    }
  }

  return 0;
}

/**
 * Converts a SemVer object back to a string.
 * @param version - SemVer object to stringify
 * @returns Version string
 */
export function stringifyVersion(version: SemVer): string {
  let result = `${version.major}.${version.minor}.${version.patch}`;

  if (version.prerelease) {
    result += `-${version.prerelease}`;
  }

  if (version.build) {
    result += `+${version.build}`;
  }

  return result;
}

/**
 * Finds the highest version from an array of versions.
 * @param versions - Array of versions to compare
 * @returns Highest version or undefined if array is empty
 */
export function getHighestVersion(versions: readonly SemVer[]): SemVer | undefined {
  if (versions.length === 0) {
    return undefined;
  }

  return versions.reduce((highest, current) =>
    compareVersions(current, highest) > 0 ? current : highest
  );
}
