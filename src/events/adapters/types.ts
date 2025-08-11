/**
 * @file Public types for Events adapters.
 */
import type { EventOptions } from '@types';

export interface EventAdapter {
  name: string;
  onStart?(ctx: Record<string, unknown>): void;
  onNamespace?(namespace: string): void;
  onDefine?(namespace: string, eventName: string, options?: EventOptions): void;
  onEmit?(namespace: string, eventName: string, payload: unknown): void;
}

/**
 * Function that composes a single event name from namespace and event name.
 */
export type EventNameComposer = (namespace: string, eventName: string) => string;

export interface NodeEventEmitterLike {
  emit(eventName: string, ...args: unknown[]): boolean;
  on(eventName: string, listener: (...args: unknown[]) => void): unknown;
}

export interface NodeEventEmitterAdapterOptions {
  emitter: NodeEventEmitterLike;
  toEventName?: EventNameComposer;
}

export interface RxjsSubjectLike<T = unknown> {
  next(value: T): void;
}

export interface RxjsAdapterOptions<T = unknown> {
  subjectFactory: (namespace: string, eventName: string) => RxjsSubjectLike<T>;
}

/**
 * Node EventEmitter adapter type.
 */
export type NodeEventEmitterAdapter = EventAdapter & { getEmitter(): NodeEventEmitterLike };
