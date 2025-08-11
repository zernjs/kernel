/**
 * @file Unit tests for augmentation helpers.
 */
import { describe, it, expect } from 'vitest';
import { mergeApis, createAugmenter } from '@plugin/augmentation';

describe('mergeApis', () => {
  it('throws on conflict when policy is error', () => {
    expect(() => mergeApis({ a: 1 }, { a: 2 }, { policy: 'error' })).toThrow(
      'Augmentation conflict'
    );
  });

  it('overrides when policy is override', () => {
    const merged = mergeApis({ a: 1 }, { a: 2 }, { policy: 'override' });
    expect(merged.a).toBe(2);
  });

  it('namespaces conflicting keys when policy is namespace', () => {
    const merged = mergeApis<{ a: number }, { a: number }>(
      { a: 1 },
      { a: 2 },
      { policy: 'namespace', namespacePrefix: 'ns' }
    );
    // Cast to a dictionary view to access namespaced key
    const dict = merged as unknown as Record<string, number>;
    expect(dict.a).toBe(1);
    expect(dict['ns.a']).toBe(2);
  });

  it('freezes leaf objects to prevent mutation', () => {
    const merged = mergeApis<{ obj: { x: number } }, { extra: { y: number } }>(
      { obj: { x: 1 } },
      { extra: { y: 2 } },
      { policy: 'override' }
    );
    expect(Object.isFrozen(merged.obj)).toBe(true);
    expect(Object.isFrozen(merged.extra)).toBe(true);
  });
});

describe('createAugmenter', () => {
  it('merges api into target and updates reference', () => {
    const targets: { svc: { a: number; b?: number } } = { svc: { a: 1 } };
    const augment = createAugmenter(targets, { policy: 'override' });
    augment('svc', { b: 2 });
    expect(targets.svc).toMatchObject({ a: 1, b: 2 });
    expect(Object.isFrozen(targets.svc)).toBe(false);
  });
});
