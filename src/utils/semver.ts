export type SemverRange = string; // simplificado por enquanto

export class SemverValidator {
  static parse(version: string): { major: number; minor: number; patch: number } {
    const m = version.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m) throw new Error(`Invalid version: ${version}`);
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
  }

  static satisfies(actual: string, range: SemverRange): boolean {
    // Suporte básico: exato, ^, ~, >=, >, <, <=, intervalos com ||
    if (!range.match(/^[~^>=<]/)) return actual === range;

    const a = this.parse(actual);
    if (range.startsWith('^')) {
      const r = this.parse(range.slice(1));
      return (
        a.major === r.major && (a.minor > r.minor || (a.minor === r.minor && a.patch >= r.patch))
      );
    }
    if (range.startsWith('~')) {
      const r = this.parse(range.slice(1));
      return a.major === r.major && a.minor === r.minor && a.patch >= r.patch;
    }
    if (range.startsWith('>=')) {
      const r = this.parse(range.slice(2));
      if (a.major > r.major) return true;
      if (a.major < r.major) return false;
      if (a.minor > r.minor) return true;
      if (a.minor < r.minor) return false;
      return a.patch >= r.patch;
    }
    if (range.startsWith('>')) {
      const r = this.parse(range.slice(1));
      if (a.major > r.major) return true;
      if (a.major < r.major) return false;
      if (a.minor > r.minor) return true;
      if (a.minor < r.minor) return false;
      return a.patch > r.patch;
    }
    if (range.startsWith('<=')) {
      const r = this.parse(range.slice(2));
      if (a.major < r.major) return true;
      if (a.major > r.major) return false;
      if (a.minor < r.minor) return true;
      if (a.minor > r.minor) return false;
      return a.patch <= r.patch;
    }
    if (range.startsWith('<')) {
      const r = this.parse(range.slice(1));
      if (a.major < r.major) return true;
      if (a.major > r.major) return false;
      if (a.minor < r.minor) return true;
      if (a.minor > r.minor) return false;
      return a.patch < r.patch;
    }

    // Suporte simples para 'x || y'
    if (range.includes('||')) {
      return range
        .split('||')
        .map(s => s.trim())
        .some(r => this.satisfies(actual, r));
    }
    return false;
  }
}
