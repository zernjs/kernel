/**
 * Simple Zero-Dependency SemVer Implementation
 * Supports: x.y.z, ^x.y.z, ~x.y.z, >x.y.z, >=x.y.z, <x.y.z, <=x.y.z
 */

export type Version = string;

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

const SEMVER_REGEX =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([\da-z-]+(?:\.[\da-z-]+)*))?(?:\+([\da-z-]+(?:\.[\da-z-]+)*))?$/i;

export function parseVersion(version: string): SemVer | null {
  const match = version.match(SEMVER_REGEX);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

export function compareVersions(v1: string, v2: string): -1 | 0 | 1 {
  const s1 = parseVersion(v1);
  const s2 = parseVersion(v2);

  if (!s1 || !s2) throw new Error(`Invalid version comparison: ${v1} vs ${v2}`);

  if (s1.major > s2.major) return 1;
  if (s1.major < s2.major) return -1;

  if (s1.minor > s2.minor) return 1;
  if (s1.minor < s2.minor) return -1;

  if (s1.patch > s2.patch) return 1;
  if (s1.patch < s2.patch) return -1;

  // Prerelease handling (simplified: prerelease < release)
  if (s1.prerelease && !s2.prerelease) return -1;
  if (!s1.prerelease && s2.prerelease) return 1;
  if (s1.prerelease && s2.prerelease) {
    if (s1.prerelease > s2.prerelease) return 1;
    if (s1.prerelease < s2.prerelease) return -1;
  }

  return 0;
}

export function satisfies(version: string, range: string): boolean {
  if (range === '*' || range === 'latest') return true;

  const v = parseVersion(version);
  if (!v) return false;

  // Handle ^ (Compatible with)
  if (range.startsWith('^')) {
    const base = parseVersion(range.substring(1));
    if (!base) return false;
    // ^1.2.3 := >=1.2.3 <2.0.0
    // ^0.2.3 := >=0.2.3 <0.3.0
    // ^0.0.3 := >=0.0.3 <0.0.4
    if (base.major === 0) {
      if (base.minor === 0) {
        return compareVersions(version, range.substring(1)) === 0;
      }
      return (
        compareVersions(version, range.substring(1)) >= 0 &&
        compareVersions(version, `0.${base.minor + 1}.0`) < 0
      );
    }
    return (
      compareVersions(version, range.substring(1)) >= 0 &&
      compareVersions(version, `${base.major + 1}.0.0`) < 0
    );
  }

  // Handle ~ (Approximate)
  if (range.startsWith('~')) {
    const base = parseVersion(range.substring(1));
    if (!base) return false;
    // ~1.2.3 := >=1.2.3 <1.3.0
    return (
      compareVersions(version, range.substring(1)) >= 0 &&
      compareVersions(version, `${base.major}.${base.minor + 1}.0`) < 0
    );
  }

  // Handle >, >=, <, <=
  if (range.startsWith('>=')) return compareVersions(version, range.substring(2)) >= 0;
  if (range.startsWith('>')) return compareVersions(version, range.substring(1)) === 1;
  if (range.startsWith('<=')) return compareVersions(version, range.substring(2)) <= 0;
  if (range.startsWith('<')) return compareVersions(version, range.substring(1)) === -1;

  // Exact match
  if (range.startsWith('=')) return compareVersions(version, range.substring(1)) === 0;

  return compareVersions(version, range) === 0;
}
