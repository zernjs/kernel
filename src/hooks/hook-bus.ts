import type { Hook } from '@types';
import { hook } from '@hooks';
import type { ErrorBus } from '@errors';
import { debounce, throttle } from '@utils';

export class HookBus {
  private readonly hooks = new Map<string, Hook<unknown>>();
  private onHandlerError?: (name: string, err: unknown) => void;

  constructor(errorBus?: ErrorBus) {
    if (errorBus) {
      this.onHandlerError = (name: string, err: unknown): void => {
        void errorBus.emit('hooks', 'HandlerError', err, { source: 'hook', eventName: name });
      };
    }
  }

  define<Payload>(name: string): Hook<Payload> {
    const h = hook<Payload>(
      this.onHandlerError ? (err: unknown): void => this.onHandlerError?.(name, err) : undefined
    );
    this.hooks.set(name, h as unknown as Hook<unknown>);
    const withUtils = h as Hook<Payload> & {
      debounce: (ms: number) => Hook<Payload>;
      throttle: (ms: number) => Hook<Payload>;
    };
    withUtils.debounce = (ms: number): Hook<Payload> => {
      const originalOn = h.on;
      const debouncedOn: Hook<Payload>['on'] = handler =>
        originalOn(debounce(handler as (arg: unknown) => unknown, ms) as (p: Payload) => void);
      return { ...h, on: debouncedOn } as Hook<Payload>;
    };
    withUtils.throttle = (ms: number): Hook<Payload> => {
      const originalOn = h.on;
      const throttledOn: Hook<Payload>['on'] = handler =>
        originalOn(throttle(handler as (arg: unknown) => unknown, ms) as (p: Payload) => void);
      return { ...h, on: throttledOn } as Hook<Payload>;
    };
    return withUtils;
  }

  get<Payload>(name: string): Hook<Payload> | undefined {
    return this.hooks.get(name) as Hook<Payload> | undefined;
  }
}
