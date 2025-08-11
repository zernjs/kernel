/**
 * @file Public types root. Re-exports all layer types to the '@types' alias.
 * Keep broad exports to preserve internal/test imports.
 */
export * from '../alerts/types';
export * from '../core/types';
export * from '../diagnostics/types';
export * from '../errors/types';
export {
  EventDef,
  TypedEvents,
  GlobalEventMap,
  DeliveryMode,
  StartupMode,
  EventNamespace,
  EventName,
  EventKey,
  EventOptions,
  EventHandler,
  BivariantEventHandler,
  Event,
  Next,
  EventContext,
  Operator,
  NamespaceApi,
  NamespaceSpec,
  NamespaceApiTyped,
} from '../events/types';
export * from '../events/adapters/types';
export * from '../hooks/types';
export * from '../lifecycle/types';
export * from '../plugin/types';
export * from '../resolve/types';
export * from '../errors/kernel-errors';

// DX note: For autocomplete in zero-arg useEvents()/useAlerts() in an application,
// add a module augmentation file in your app (not in library src). See
// examples/typed-globals.d.ts for a minimal template.
export {};
