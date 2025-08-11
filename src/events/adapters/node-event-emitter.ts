/**
 * @file Node.js EventEmitter adapter for the Events layer.
 */
import type {
  NodeEventEmitterAdapter,
  NodeEventEmitterLike,
  NodeEventEmitterAdapterOptions,
  EventNameComposer,
} from '@types';

/**
 * Create an adapter that mirrors event emissions to a Node EventEmitter instance.
 * @param options - Adapter options with a target `emitter` and optional `toEventName` composer.
 * @returns Adapter with `onEmit` hook and a `getEmitter()` accessor.
 */
export function createNodeEventEmitterAdapter(
  options: NodeEventEmitterAdapterOptions
): NodeEventEmitterAdapter {
  const composeEventName: EventNameComposer =
    options.toEventName ?? ((namespace, eventName): string => `${namespace}:${eventName}`);

  const { emitter } = options;

  const adapter: NodeEventEmitterAdapter = {
    name: 'node-event-emitter',
    onEmit(namespace, eventName, payload): void {
      const compositeName = composeEventName(namespace, eventName);
      emitter.emit(compositeName, payload);
    },
    getEmitter(): NodeEventEmitterLike {
      return emitter;
    },
  };

  return adapter;
}
