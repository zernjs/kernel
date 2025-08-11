/**
 * @file Public types for the entire application.
 */
export { AlertDef, TypedAlerts, GlobalAlertMap } from '../alerts/types';
export * from '../core/types';
export * from '../diagnostics/types';
export * from '../errors/types';
export { EventDef, TypedEvents, GlobalEventMap } from '../events/types';
export * from '../hooks/types';
export * from '../lifecycle/types';
export * from '../plugin/types';
export * from '../resolve/types';
export * from '../errors/kernel-errors';

// DX note: For autocomplete in zero-arg useEvents()/useAlerts() in an application,
// add a module augmentation file in your app (not in library src). See
// examples/typed-globals.d.ts for a minimal template.
export {};
