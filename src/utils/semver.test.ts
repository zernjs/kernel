import { describe, it, expect } from 'vitest';
import { SemverValidator } from './semver';

describe('SemverValidator', () => {
  it('parses valid semantic versions', () => {
    expect(SemverValidator.parse('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('throws on invalid versions', () => {
    expect(() => SemverValidator.parse('1.2')).toThrowError();
    expect(() => SemverValidator.parse('v1.2.3')).toThrowError();
  });

  it('satisfies exact match', () => {
    expect(SemverValidator.satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(SemverValidator.satisfies('1.2.4', '1.2.3')).toBe(false);
  });

  it('satisfies caret ^ ranges', () => {
    expect(SemverValidator.satisfies('1.2.3', '^1.2.3')).toBe(true);
    expect(SemverValidator.satisfies('1.3.0', '^1.2.3')).toBe(true);
    expect(SemverValidator.satisfies('2.0.0', '^1.2.3')).toBe(false);
  });

  it('satisfies tilde ~ ranges', () => {
    expect(SemverValidator.satisfies('1.2.3', '~1.2.3')).toBe(true);
    expect(SemverValidator.satisfies('1.2.9', '~1.2.3')).toBe(true);
    expect(SemverValidator.satisfies('1.3.0', '~1.2.3')).toBe(false);
  });

  it('satisfies >= ranges', () => {
    expect(SemverValidator.satisfies('1.2.3', '>=1.2.3')).toBe(true);
    expect(SemverValidator.satisfies('1.2.4', '>=1.2.3')).toBe(true);
    expect(SemverValidator.satisfies('1.3.0', '>=1.2.3')).toBe(true);
    expect(SemverValidator.satisfies('1.2.2', '>=1.2.3')).toBe(false);
  });
});
