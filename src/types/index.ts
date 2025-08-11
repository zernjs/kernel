/**
 * @file Public types for the entire application.
 */
export * from '../alerts/types';
export * from '../core/types';
export * from '../diagnostics/types';
export * from '../errors/types';
export * from '../events/types';
export * from '../hooks/types';
export * from '../lifecycle/types';
export * from '../plugin/types';
export * from '../resolve/types';
export * from '../errors/kernel-errors';

// Central augmentation for global event namespaces used by zero-arg useEvents().
// Projects can edit this single file to add their namespaces.
export {};
declare module '../events/types' {
  interface ZernEvents {
    // Example app: wire the 'auth' namespace once, instead of per-plugin.
    // If you split plugins across packages, move this augmentation to your app root.
    auth: typeof import('../../examples/auth.plugin').ev.spec;
  }
}
