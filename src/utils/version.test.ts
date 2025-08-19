import { describe, it, expect } from 'vitest';
import { parseVersion, compareVersions, satisfiesVersion, isValidVersionRange } from './version';
import type { Version } from '@/core';

describe('parseVersion', () => {
  it('should parse basic semantic version', () => {
    const result = parseVersion('1.2.3' as Version);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
      build: undefined,
    });
  });

  it('should parse version with prerelease', () => {
    const result = parseVersion('1.2.3-alpha.1' as Version);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: 'alpha.1',
      build: undefined,
    });
  });

  it('should parse version with build metadata', () => {
    const result = parseVersion('1.2.3+build.123' as Version);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
      build: 'build.123',
    });
  });

  it('should parse version with prerelease and build', () => {
    const result = parseVersion('1.2.3-beta.2+build.456' as Version);
    expect(result).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: 'beta.2',
      build: 'build.456',
    });
  });

  it('should parse version with complex prerelease', () => {
    const result = parseVersion('2.0.0-rc.1.2.3' as Version);
    expect(result).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
      prerelease: 'rc.1.2.3',
      build: undefined,
    });
  });

  it('should throw error for invalid version format', () => {
    expect(() => parseVersion('1.2' as Version)).toThrow('Invalid version format: 1.2');
    expect(() => parseVersion('1.2.3.4' as Version)).toThrow('Invalid version format: 1.2.3.4');
    expect(() => parseVersion('v1.2.3' as Version)).toThrow('Invalid version format: v1.2.3');
    expect(() => parseVersion('1.2.3-' as Version)).toThrow('Invalid version format: 1.2.3-');
    expect(() => parseVersion('1.2.3+' as Version)).toThrow('Invalid version format: 1.2.3+');
    expect(() => parseVersion('abc.def.ghi' as Version)).toThrow(
      'Invalid version format: abc.def.ghi'
    );
  });
});

describe('compareVersions', () => {
  it('should return 0 for equal versions', () => {
    expect(compareVersions('1.2.3' as Version, '1.2.3' as Version)).toBe(0);
    expect(compareVersions('1.0.0-alpha' as Version, '1.0.0-alpha' as Version)).toBe(0);
  });

  it('should compare major versions', () => {
    expect(compareVersions('2.0.0' as Version, '1.9.9' as Version)).toBeGreaterThan(0);
    expect(compareVersions('1.0.0' as Version, '2.0.0' as Version)).toBeLessThan(0);
  });

  it('should compare minor versions when major is equal', () => {
    expect(compareVersions('1.2.0' as Version, '1.1.9' as Version)).toBeGreaterThan(0);
    expect(compareVersions('1.1.0' as Version, '1.2.0' as Version)).toBeLessThan(0);
  });

  it('should compare patch versions when major and minor are equal', () => {
    expect(compareVersions('1.2.3' as Version, '1.2.2' as Version)).toBeGreaterThan(0);
    expect(compareVersions('1.2.2' as Version, '1.2.3' as Version)).toBeLessThan(0);
  });

  it('should handle prerelease versions correctly', () => {
    // Prerelease versions have lower precedence than normal versions
    expect(compareVersions('1.0.0-alpha' as Version, '1.0.0' as Version)).toBeLessThan(0);
    expect(compareVersions('1.0.0' as Version, '1.0.0-alpha' as Version)).toBeGreaterThan(0);
  });

  it('should compare prerelease versions alphabetically', () => {
    expect(compareVersions('1.0.0-alpha' as Version, '1.0.0-beta' as Version)).toBeLessThan(0);
    expect(compareVersions('1.0.0-beta' as Version, '1.0.0-alpha' as Version)).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-alpha.1' as Version, '1.0.0-alpha.2' as Version)).toBeLessThan(0);
  });

  it('should handle complex version comparisons', () => {
    expect(compareVersions('2.0.0-alpha' as Version, '1.9.9' as Version)).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-beta' as Version, '1.0.0-alpha.9' as Version)).toBeGreaterThan(0);
  });
});

describe('satisfiesVersion', () => {
  describe('wildcard range', () => {
    it('should satisfy any version with wildcard', () => {
      expect(satisfiesVersion('1.0.0' as Version, '*')).toBe(true);
      expect(satisfiesVersion('2.5.10' as Version, '*')).toBe(true);
      expect(satisfiesVersion('0.0.1' as Version, '*')).toBe(true);
    });
  });

  describe('caret range (^)', () => {
    it('should satisfy compatible versions with caret', () => {
      expect(satisfiesVersion('1.2.3' as Version, '^1.2.0')).toBe(true);
      expect(satisfiesVersion('1.5.0' as Version, '^1.2.0')).toBe(true);
      expect(satisfiesVersion('1.2.0' as Version, '^1.2.0')).toBe(true);
    });

    it('should not satisfy incompatible major versions with caret', () => {
      expect(satisfiesVersion('2.0.0' as Version, '^1.2.0')).toBe(false);
      expect(satisfiesVersion('0.9.9' as Version, '^1.2.0')).toBe(false);
    });

    it('should not satisfy lower versions with caret', () => {
      expect(satisfiesVersion('1.1.9' as Version, '^1.2.0')).toBe(false);
    });
  });

  describe('tilde range (~)', () => {
    it('should satisfy patch-level changes with tilde', () => {
      expect(satisfiesVersion('1.2.3' as Version, '~1.2.0')).toBe(true);
      expect(satisfiesVersion('1.2.9' as Version, '~1.2.0')).toBe(true);
      expect(satisfiesVersion('1.2.0' as Version, '~1.2.0')).toBe(true);
    });

    it('should not satisfy minor version changes with tilde', () => {
      expect(satisfiesVersion('1.3.0' as Version, '~1.2.0')).toBe(false);
      expect(satisfiesVersion('1.1.9' as Version, '~1.2.0')).toBe(false);
    });

    it('should not satisfy major version changes with tilde', () => {
      expect(satisfiesVersion('2.2.0' as Version, '~1.2.0')).toBe(false);
      expect(satisfiesVersion('0.2.0' as Version, '~1.2.0')).toBe(false);
    });

    it('should not satisfy lower patch versions with tilde', () => {
      expect(satisfiesVersion('1.2.0' as Version, '~1.2.3')).toBe(false);
    });
  });

  describe('exact match', () => {
    it('should satisfy exact version match', () => {
      expect(satisfiesVersion('1.2.3' as Version, '1.2.3')).toBe(true);
      expect(satisfiesVersion('1.0.0-alpha' as Version, '1.0.0-alpha')).toBe(true);
    });

    it('should not satisfy different versions', () => {
      expect(satisfiesVersion('1.2.4' as Version, '1.2.3')).toBe(false);
      expect(satisfiesVersion('1.2.3' as Version, '1.2.4')).toBe(false);
      expect(satisfiesVersion('1.0.0' as Version, '1.0.0-alpha')).toBe(false);
    });
  });
});

describe('isValidVersionRange', () => {
  describe('wildcard ranges', () => {
    it('should validate wildcard range', () => {
      expect(isValidVersionRange('*')).toBe(true);
    });
  });

  describe('caret ranges', () => {
    it('should validate caret ranges', () => {
      expect(isValidVersionRange('^1.2.3')).toBe(true);
      expect(isValidVersionRange('^0.0.1')).toBe(true);
      expect(isValidVersionRange('^10.5.2')).toBe(true);
    });

    it('should invalidate malformed caret ranges', () => {
      expect(isValidVersionRange('^1.2')).toBe(false);
      expect(isValidVersionRange('^abc')).toBe(false);
      expect(isValidVersionRange('^')).toBe(false);
    });
  });

  describe('tilde ranges', () => {
    it('should validate tilde ranges', () => {
      expect(isValidVersionRange('~1.2.3')).toBe(true);
      expect(isValidVersionRange('~0.0.1')).toBe(true);
      expect(isValidVersionRange('~10.5.2')).toBe(true);
    });

    it('should invalidate malformed tilde ranges', () => {
      expect(isValidVersionRange('~1.2')).toBe(false);
      expect(isValidVersionRange('~abc')).toBe(false);
      expect(isValidVersionRange('~')).toBe(false);
    });
  });

  describe('comparison ranges', () => {
    it('should validate comparison ranges', () => {
      expect(isValidVersionRange('>=1.2.3')).toBe(true);
      expect(isValidVersionRange('<=1.2.3')).toBe(true);
      expect(isValidVersionRange('>1.2.3')).toBe(true);
      expect(isValidVersionRange('<1.2.3')).toBe(true);
      expect(isValidVersionRange('=1.2.3')).toBe(true);
    });

    it('should invalidate malformed comparison ranges', () => {
      expect(isValidVersionRange('>=1.2')).toBe(false);
      expect(isValidVersionRange('<=abc')).toBe(false);
      expect(isValidVersionRange('>=')).toBe(false);
    });
  });

  describe('exact versions', () => {
    it('should validate exact version strings', () => {
      expect(isValidVersionRange('1.2.3')).toBe(true);
      expect(isValidVersionRange('0.0.1')).toBe(true);
      expect(isValidVersionRange('10.5.2')).toBe(true);
      expect(isValidVersionRange('1.0.0-alpha')).toBe(true);
      expect(isValidVersionRange('1.0.0+build')).toBe(true);
      expect(isValidVersionRange('1.0.0-beta.1+build.123')).toBe(true);
    });

    it('should invalidate malformed version strings', () => {
      expect(isValidVersionRange('1.2')).toBe(false);
      expect(isValidVersionRange('1.2.3.4')).toBe(false);
      expect(isValidVersionRange('v1.2.3')).toBe(false);
      expect(isValidVersionRange('abc.def.ghi')).toBe(false);
      expect(isValidVersionRange('1.2.3-')).toBe(false);
      expect(isValidVersionRange('1.2.3+')).toBe(false);
      expect(isValidVersionRange('')).toBe(false);
    });
  });
});
