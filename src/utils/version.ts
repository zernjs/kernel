import type { Version } from '@/core';

export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
  readonly build?: string;
}

export function parseVersion(version: Version): SemanticVersion {
  const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+([\w.-]+))?$/;
  const match = version.match(regex);

  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

export function compareVersions(a: Version, b: Version): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  if (versionA.major !== versionB.major) {
    return versionA.major - versionB.major;
  }

  if (versionA.minor !== versionB.minor) {
    return versionA.minor - versionB.minor;
  }

  if (versionA.patch !== versionB.patch) {
    return versionA.patch - versionB.patch;
  }

  if (versionA.prerelease && !versionB.prerelease) return -1;
  if (!versionA.prerelease && versionB.prerelease) return 1;
  if (versionA.prerelease && versionB.prerelease) {
    return versionA.prerelease.localeCompare(versionB.prerelease);
  }

  return 0;
}

export function satisfiesVersion(version: Version, range: string): boolean {
  if (range === '*') return true;

  if (range.startsWith('^')) {
    const targetVersion = range.slice(1);
    const target = parseVersion(targetVersion as Version);
    const current = parseVersion(version);

    return (
      current.major === target.major && compareVersions(version, targetVersion as Version) >= 0
    );
  }

  if (range.startsWith('~')) {
    const targetVersion = range.slice(1);
    const target = parseVersion(targetVersion as Version);
    const current = parseVersion(version);

    return (
      current.major === target.major &&
      current.minor === target.minor &&
      current.patch >= target.patch
    );
  }

  return version === range;
}

export function isValidVersionRange(range: string): boolean {
  if (range === '*') return true;

  const prefixes = ['^', '~', '>=', '<=', '>', '<', '='];
  const hasPrefix = prefixes.some(prefix => range.startsWith(prefix));

  if (hasPrefix) {
    const version = range.replace(/^[^\d]+/, '');
    return isValidVersion(version);
  }

  return isValidVersion(range);
}

function isValidVersion(version: string): boolean {
  const regex = /^\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
  return regex.test(version);
}
