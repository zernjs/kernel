/**
 * Zero-Dependency SemVer Implementation.
 * Supports a subset of Semantic Versioning for lightweight usage.
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

/**
 * Parses a version string into a SemVer object.
 *
 * @param version - The version string to parse.
 * @returns The parsed SemVer object or null if invalid.
 */
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

/**
 * Compares two version strings.
 *
 * @param v1 - The first version string.
 * @param v2 - The second version string.
 * @returns -1 if v1 < v2, 1 if v1 > v2, 0 if v1 == v2.
 * @throws Error if any version string is invalid.
 */
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

  if (s1.prerelease && !s2.prerelease) return -1;
  if (!s1.prerelease && s2.prerelease) return 1;
  if (s1.prerelease && s2.prerelease) {
    if (s1.prerelease > s2.prerelease) return 1;
    if (s1.prerelease < s2.prerelease) return -1;
  }

  return 0;
}

/**
 * Checks if a version satisfies a given range.
 * Supports: x.y.z, ^x.y.z, ~x.y.z, >=x.y.z, etc.
 *
 * @param version - The version to check.
 * @param range - The version range.
 * @returns True if the version satisfies the range.
 */
export function satisfies(version: string, range: string): boolean {
  if (range === '*' || range === 'latest') return true;

  const v = parseVersion(version);
  if (!v) return false;

  if (range.startsWith('^')) {
    const base = parseVersion(range.substring(1));
    if (!base) return false;
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

  if (range.startsWith('~')) {
    const base = parseVersion(range.substring(1));
    if (!base) return false;
    return (
      compareVersions(version, range.substring(1)) >= 0 &&
      compareVersions(version, `${base.major}.${base.minor + 1}.0`) < 0
    );
  }

  if (range.startsWith('>=')) return compareVersions(version, range.substring(2)) >= 0;
  if (range.startsWith('>')) return compareVersions(version, range.substring(1)) === 1;
  if (range.startsWith('<=')) return compareVersions(version, range.substring(2)) <= 0;
  if (range.startsWith('<')) return compareVersions(version, range.substring(1)) === -1;

  if (range.startsWith('=')) return compareVersions(version, range.substring(1)) === 0;

  return compareVersions(version, range) === 0;
}
