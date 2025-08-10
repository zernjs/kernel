import type { EventAdapter, NodeEventEmitterLike, NodeEventEmitterAdapterOptions } from '@types';

export function createNodeEventEmitterAdapter(
  options: NodeEventEmitterAdapterOptions
): EventAdapter & { getEmitter(): NodeEventEmitterLike } {
  const toEvent: (ns: string, ev: string) => string =
    options.toEventName ?? ((ns: string, ev: string): string => `${ns}:${ev}`);
  const { emitter } = options;

  const adapter: EventAdapter & { getEmitter(): NodeEventEmitterLike } = {
    name: 'node-event-emitter',
    onEmit(namespace, eventName, payload): void {
      emitter.emit(toEvent(namespace, eventName), payload);
    },
    getEmitter(): NodeEventEmitterLike {
      return emitter;
    },
  };

  return adapter;
}
