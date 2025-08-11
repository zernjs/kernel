/**
 * @file Plugin API augmentation helpers (merge and apply augmentations).
 */
import type { AugmentationOptions } from '@types';
import { KernelError } from '@errors';
import { hasOwn, isObject } from '@utils';

type UnknownRecord = Record<string, unknown>;

function computeNamespacedKey(prefix: string | undefined, key: string): string {
  const pref = prefix ?? 'aug';
  return `${pref}.${key}`;
}

function handleConflict(
  policy: AugmentationOptions['policy'],
  out: UnknownRecord,
  key: string,
  value: unknown,
  namespacePrefix?: string
): boolean {
  if (policy === 'error') {
    throw new KernelError('AugmentationConflict', `Augmentation conflict on key '${key}'`, { key });
  }
  if (policy === 'namespace') {
    out[computeNamespacedKey(namespacePrefix, key)] = value;
    return true;
  }
  // policy === 'override' → fallthrough to assign out[key] below
  return false;
}

function freezeLeafObjects(out: UnknownRecord): void {
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (isObject(v)) Object.freeze(v);
  }
}

export function mergeApis<TBase extends object, TAug extends object>(
  base: TBase,
  aug: TAug,
  opts: AugmentationOptions = {}
): TBase & TAug {
  const policy = opts.policy ?? 'error';
  const out: UnknownRecord = { ...(base as unknown as UnknownRecord) };

  for (const [key, value] of Object.entries(aug as UnknownRecord)) {
    if (hasOwn(out, key)) {
      const skipOverride = handleConflict(policy, out, key, value, opts.namespacePrefix);
      if (skipOverride) continue;
    }
    out[key] = value;
  }

  freezeLeafObjects(out);
  return out as TBase & TAug;
}

export function createAugmenter<TTargets extends Record<string, object>>(
  targets: TTargets,
  opts?: AugmentationOptions
): <K extends keyof TTargets & string, TAug extends Partial<TTargets[K]>>(
  target: K,
  api: TAug
) => void {
  return (target, api) => {
    const current = targets[target];
    const merged = mergeApis(current, api as object, opts);
    (targets as Record<string, object>)[target] = merged;
  };
}
