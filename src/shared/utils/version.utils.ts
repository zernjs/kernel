/**
 * Utilitários para manipulação de versões semânticas
 */

import { Version } from '../types';
import type {
  VersionConstraint,
  VersionOperator,
} from '../../domain/dependency/dependency.types.js';

/**
 * Interface para versão semântica parseada
 */
export interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
  readonly build?: string;
}

/**
 * Parseia uma versão semântica
 */
export function parseVersion(version: Version): ParsedVersion {
  const regex = /^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+(.+))?$/;
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

/**
 * Compara duas versões
 * @returns -1 se v1 < v2, 0 se v1 === v2, 1 se v1 > v2
 */
export function compareVersions(v1: Version, v2: Version): number {
  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);

  // Comparar major
  if (parsed1.major !== parsed2.major) {
    return parsed1.major - parsed2.major;
  }

  // Comparar minor
  if (parsed1.minor !== parsed2.minor) {
    return parsed1.minor - parsed2.minor;
  }

  // Comparar patch
  if (parsed1.patch !== parsed2.patch) {
    return parsed1.patch - parsed2.patch;
  }

  // Comparar prerelease
  if (parsed1.prerelease && !parsed2.prerelease) return -1;
  if (!parsed1.prerelease && parsed2.prerelease) return 1;
  if (parsed1.prerelease && parsed2.prerelease) {
    return parsed1.prerelease.localeCompare(parsed2.prerelease);
  }

  return 0;
}

/**
 * Verifica se uma versão satisfaz um range
 */
export function satisfiesRange(version: Version, range: string): boolean {
  // Implementação simplificada para ranges comuns
  if (range.startsWith('^')) {
    return satisfiesCaretRange(version, range.slice(1));
  }

  if (range.startsWith('~')) {
    return satisfiesTildeRange(version, range.slice(1));
  }

  if (range.startsWith('>=')) {
    return compareVersions(version, range.slice(2) as Version) >= 0;
  }

  if (range.startsWith('>')) {
    return compareVersions(version, range.slice(1) as Version) > 0;
  }

  if (range.startsWith('<=')) {
    return compareVersions(version, range.slice(2) as Version) <= 0;
  }

  if (range.startsWith('<')) {
    return compareVersions(version, range.slice(1) as Version) < 0;
  }

  // Versão exata
  return compareVersions(version, range as Version) === 0;
}

/**
 * Verifica compatibilidade com caret range (^1.2.3)
 */
function satisfiesCaretRange(version: Version, baseVersion: string): boolean {
  const parsed = parseVersion(version);
  const baseParsed = parseVersion(baseVersion as Version);

  // Major deve ser igual
  if (parsed.major !== baseParsed.major) {
    return false;
  }

  // Versão deve ser >= base
  return compareVersions(version, baseVersion as Version) >= 0;
}

/**
 * Verifica compatibilidade com tilde range (~1.2.3)
 */
function satisfiesTildeRange(version: Version, baseVersion: string): boolean {
  const parsed = parseVersion(version);
  const baseParsed = parseVersion(baseVersion as Version);

  // Major e minor devem ser iguais
  if (parsed.major !== baseParsed.major || parsed.minor !== baseParsed.minor) {
    return false;
  }

  // Patch deve ser >= base
  return parsed.patch >= baseParsed.patch;
}

/**
 * Encontra a maior versão em uma lista
 */
export function getLatestVersion(versions: readonly Version[]): Version | null {
  if (versions.length === 0) {
    return null;
  }

  return versions.reduce((latest, current) =>
    compareVersions(current, latest) > 0 ? current : latest
  );
}

/**
 * Filtra versões que satisfazem um range
 */
export function filterVersionsByRange(versions: readonly Version[], range: string): Version[] {
  return versions.filter(version => satisfiesRange(version, range));
}

/**
 * Parseia uma string de constraint de versão em um objeto VersionConstraint
 */
export function parseConstraint(constraintStr: string): VersionConstraint {
  const trimmed = constraintStr.trim();

  // Detecta o operador
  if (trimmed.startsWith('^')) {
    return {
      operator: '^' as VersionOperator,
      version: trimmed.slice(1) as Version,
      raw: trimmed,
    };
  }

  if (trimmed.startsWith('~')) {
    return {
      operator: '~' as VersionOperator,
      version: trimmed.slice(1) as Version,
      raw: trimmed,
    };
  }

  if (trimmed.startsWith('>=')) {
    return {
      operator: '>=' as VersionOperator,
      version: trimmed.slice(2) as Version,
      raw: trimmed,
    };
  }

  if (trimmed.startsWith('>')) {
    return {
      operator: '>' as VersionOperator,
      version: trimmed.slice(1) as Version,
      raw: trimmed,
    };
  }

  if (trimmed.startsWith('<=')) {
    return {
      operator: '<=' as VersionOperator,
      version: trimmed.slice(2) as Version,
      raw: trimmed,
    };
  }

  if (trimmed.startsWith('<')) {
    return {
      operator: '<' as VersionOperator,
      version: trimmed.slice(1) as Version,
      raw: trimmed,
    };
  }

  if (trimmed === '*') {
    return {
      operator: '*' as VersionOperator,
      version: '*' as Version,
      raw: trimmed,
    };
  }

  // Versão exata (sem operador)
  return {
    operator: '=' as VersionOperator,
    version: trimmed as Version,
    raw: trimmed,
  };
}
