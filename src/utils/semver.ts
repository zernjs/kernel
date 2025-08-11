/**
 * @file Minimal semantic version utilities: parse and satisfies.
 */

export type SemverRange = string;

interface SemverTriple {
  major: number;
  minor: number;
  patch: number;
}

function parseTriple(version: string): SemverTriple {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`Invalid version: ${version}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareTriples(a: SemverTriple, b: SemverTriple): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

export class SemverValidator {
  static parse(version: string): SemverTriple {
    return parseTriple(version);
  }

  static satisfies(actual: string, range: SemverRange): boolean {
    if (!range.match(/^[~^>=<]/)) return actual === range;

    const a = parseTriple(actual);

    if (range.startsWith('^')) {
      const r = parseTriple(range.slice(1));
      return a.major === r.major && compareTriples(a, r) >= 0;
    }

    if (range.startsWith('~')) {
      const r = parseTriple(range.slice(1));
      return a.major === r.major && a.minor === r.minor && a.patch >= r.patch;
    }

    if (range.startsWith('>=')) {
      const r = parseTriple(range.slice(2));
      return compareTriples(a, r) >= 0;
    }

    if (range.startsWith('>')) {
      const r = parseTriple(range.slice(1));
      return compareTriples(a, r) > 0;
    }

    if (range.startsWith('<=')) {
      const r = parseTriple(range.slice(2));
      return compareTriples(a, r) <= 0;
    }

    if (range.startsWith('<')) {
      const r = parseTriple(range.slice(1));
      return compareTriples(a, r) < 0;
    }

    // simple OR support: 'x || y'
    if (range.includes('||')) {
      return range
        .split('||')
        .map(s => s.trim())
        .some(r => this.satisfies(actual, r));
    }

    return false;
  }
}
