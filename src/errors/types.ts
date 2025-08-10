export interface ErrorMeta {
  source?: 'event' | 'hook' | 'lifecycle' | 'custom';
  namespace?: string;
  eventName?: string;
  plugin?: string;
}

export type ErrorPolicy = (err: unknown, meta?: ErrorMeta) => Promise<void> | void;

export type ErrorHandler<Payload> = (payload: Payload, meta?: ErrorMeta) => void | Promise<void>;

export type KernelErrorCode =
  | 'DependencyMissing'
  | 'DependencyVersionUnsatisfied'
  | 'DependencyCycle'
  | 'LifecyclePhaseFailed'
  | 'InvalidVersionSpec'
  | 'AugmentationConflict';
