/**
 * @file Unit tests for KernelError helpers and type guard.
 */
import { describe, it, expect } from 'vitest';
import {
  KernelError,
  isKernelError,
  dependencyMissing,
  dependencyVersionUnsatisfied,
  dependencyCycle,
  lifecyclePhaseFailed,
  invalidVersionSpec,
} from '@errors/kernel-errors';

describe('KernelError class', () => {
  it('sets name, code and details; extends Error', () => {
    const details = { plugin: 'p', dependency: 'd' };
    const err = new KernelError('DependencyMissing', 'msg', details);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(KernelError);
    expect(err.name).toBe('KernelError');
    expect(err.code).toBe('DependencyMissing');
    expect(err.details).toEqual(details);
    expect(err.message).toBe('msg');
  });

  it('isKernelError type guard identifies only KernelError instances', () => {
    const ke = new KernelError('DependencyCycle', 'oops', { chain: ['a', 'b'] });
    const e = new Error('x');
    expect(isKernelError(ke)).toBe(true);
    expect(isKernelError(e)).toBe(false);
    expect(isKernelError(undefined)).toBe(false);
    expect(isKernelError(null)).toBe(false);
    expect(isKernelError({ name: 'Error' })).toBe(false);
  });
});

describe('Kernel error factories', () => {
  it('dependencyMissing builds correct error', () => {
    const err = dependencyMissing('auth', 'db');
    expect(isKernelError(err)).toBe(true);
    expect(err.code).toBe('DependencyMissing');
    expect(err.details).toEqual({ plugin: 'auth', dependency: 'db' });
    expect(err.message).toContain("Plugin 'auth' requires dependency 'db'");
  });

  it('dependencyVersionUnsatisfied builds correct error', () => {
    const err = dependencyVersionUnsatisfied('auth', 'db', '^1.2.3', '1.0.0');
    expect(err.code).toBe('DependencyVersionUnsatisfied');
    expect(err.details).toEqual({
      plugin: 'auth',
      dependency: 'db',
      required: '^1.2.3',
      found: '1.0.0',
    });
    expect(err.message).toContain("requires 'db' version ^1.2.3, found 1.0.0");
  });

  it('dependencyCycle builds correct error', () => {
    const chain = ['a', 'b', 'c'];
    const err = dependencyCycle(chain);
    expect(err.code).toBe('DependencyCycle');
    expect(err.details).toEqual({ chain });
    expect(err.message).toContain('Dependency cycle detected: a -> b -> c');
  });

  it('lifecyclePhaseFailed includes plugin, phase and optional cause', () => {
    const cause = new Error('boom');
    const err = lifecyclePhaseFailed('auth', 'init', cause);
    expect(err.code).toBe('LifecyclePhaseFailed');
    expect(err.details).toEqual({ plugin: 'auth', phase: 'init', cause });
    expect(err.message).toBe("Lifecycle phase 'init' failed for plugin 'auth'");
  });

  it('invalidVersionSpec builds correct error for range and actual', () => {
    const e1 = invalidVersionSpec('auth', 'db', 'v1', 'range');
    const e2 = invalidVersionSpec('auth', 'db', 'v1', 'actual');
    expect(e1.code).toBe('InvalidVersionSpec');
    expect(e1.details).toEqual({ plugin: 'auth', dependency: 'db', value: 'v1', which: 'range' });
    expect(e1.message).toBe("Invalid range semver 'v1' for dependency 'db' in plugin 'auth'");
    expect(e2.details.which).toBe('actual');
  });
});
