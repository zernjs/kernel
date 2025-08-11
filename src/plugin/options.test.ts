/**
 * @file Unit tests for plugin options validation.
 */
import { describe, it, expect } from 'vitest';
import { validateOptions, type PluginOptionsSpec, type OptionsValidator } from '@plugin/options';

describe('validateOptions', () => {
  it('returns undefined when spec is undefined', () => {
    expect(validateOptions(undefined, {})).toBeUndefined();
  });

  it('returns default when input is nullish', () => {
    const validator: OptionsValidator<{ a: number }, { a: number }> = {
      schema: { a: 1 },
      parse: (i: unknown) => i as { a: number },
    };
    const spec: PluginOptionsSpec<{ a: number }, { a: number }> = {
      validator,
      defaultValue: { a: 2 },
    };
    expect(validateOptions(spec, null)).toEqual({ a: 2 });
    expect(validateOptions(spec, undefined)).toEqual({ a: 2 });
  });

  it('parses input with validator.parse', () => {
    const validator: OptionsValidator<unknown, { ok: true }> = {
      schema: {},
      parse: (_: unknown) => ({ ok: true }),
    };
    const spec: PluginOptionsSpec<unknown, { ok: true }> = { validator };
    expect(validateOptions(spec, { x: 1 })).toEqual({ ok: true });
  });

  it('wraps validator error message', () => {
    const validator: OptionsValidator<unknown, never> = {
      schema: {},
      parse: (_: unknown) => {
        throw new Error('bad');
      },
    };
    const spec: PluginOptionsSpec<unknown, never> = { validator };
    expect(() => validateOptions(spec, 'x')).toThrow('Plugin options validation failed: bad');
  });
});
