import type { EventOptions } from '@types';

export interface EventAdapter {
  name: string;
  onStart?(ctx: Record<string, unknown>): void;
  onNamespace?(namespace: string): void;
  onDefine?(namespace: string, eventName: string, options?: EventOptions): void;
  onEmit?(namespace: string, eventName: string, payload: unknown): void;
}

export interface NodeEventEmitterLike {
  emit(eventName: string, ...args: unknown[]): boolean;
  on(eventName: string, listener: (...args: unknown[]) => void): unknown;
}

export interface NodeEventEmitterAdapterOptions {
  emitter: NodeEventEmitterLike;
  toEventName?: (namespace: string, eventName: string) => string;
}

export interface RxjsSubjectLike<T = unknown> {
  next(value: T): void;
}

export interface RxjsAdapterOptions<T = unknown> {
  subjectFactory: (namespace: string, eventName: string) => RxjsSubjectLike<T>;
}
