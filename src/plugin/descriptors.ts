/**
 * @file Helpers to build plugin descriptors and metadata.
 */
import type { DepItem, DetailedDep, PlainDep, PluginSpec } from '@types';
import { isString } from '@utils';

export interface PluginMetadata<Name extends string = string> {
  readonly name: Name;
  readonly version: string;
  readonly description?: string;
  readonly loadBefore?: readonly string[];
  readonly loadAfter?: readonly string[];
  readonly dependencies?: readonly { name: string; version?: string; optional?: boolean }[];
}

export function isDetailed(dep: DepItem): dep is DetailedDep {
  return typeof (dep as DetailedDep).plugin === 'function';
}

export function toDependencyRecord(dep: DepItem): {
  name: string;
  version?: string;
  optional?: boolean;
} {
  const ctor = isDetailed(dep) ? dep.plugin : (dep as PlainDep);
  const name = new ctor().metadata.name;
  return isDetailed(dep) ? { name, version: dep.version, optional: dep.optional } : { name };
}

function normalizeName<Name extends string>(name: Name): Name {
  return isString(name) ? name : (String(name) as Name);
}

export function createPluginMetadata<const Name extends string, API extends object>(
  spec: PluginSpec<Name, API>
): PluginMetadata<Name> {
  const normalizedName = normalizeName(spec.name);
  const metadata: PluginMetadata<Name> = {
    name: normalizedName as Name,
    version: spec.version,
    description: spec.description,
    loadBefore: spec.loadBefore,
    loadAfter: spec.loadAfter,
    dependencies: spec.dependsOn ? spec.dependsOn.map(toDependencyRecord) : undefined,
  } as const;
  return metadata;
}
