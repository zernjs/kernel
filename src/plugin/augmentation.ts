import type { AugmentationOptions } from '@types';
import { KernelError } from '@errors';
import { hasOwn, isObject } from '@utils';

export function mergeApis<TBase extends object, TAug extends object>(
  base: TBase,
  aug: TAug,
  opts: AugmentationOptions = {}
): TBase & TAug {
  const policy = opts.policy ?? 'error';
  const out: Record<string, unknown> = { ...(base as unknown as Record<string, unknown>) };
  for (const [key, value] of Object.entries(aug as Record<string, unknown>)) {
    if (hasOwn(out, key)) {
      if (policy === 'error') {
        throw new KernelError('AugmentationConflict', `Augmentation conflict on key '${key}'`, {
          key,
        });
      } else if (policy === 'namespace') {
        const pref = opts.namespacePrefix ?? 'aug';
        out[`${pref}.${key}`] = value;
        continue;
      } // override just replaces
    }
    out[key] = value;
  }
  // return a non-frozen merged view; freeze only plain-object leaves to avoid accidental mutation
  for (const k of Object.keys(out)) {
    const v = (out as Record<string, unknown>)[k];
    if (isObject(v)) Object.freeze(v);
  }
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
