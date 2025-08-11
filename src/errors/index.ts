/**
 * @file Errors public entrypoint.
 */
export * from './error-bus';
export * from './kernel-errors';
export * from './policies';
export * from './types';

/**
 * Declarative alias mirroring `events.createEvents` for consistency.
 * Re-exports `defineErrors` as `createErrors`.
 */
export { defineErrors as createErrors } from './error-bus';
