/**
 * @file Hook bus with error reporting and debounce/throttle utilities.
 */
import type { Hook, HookErrorHandler, HookName } from '@types';
import { hook } from '@hooks';
import type { ErrorBus } from '@errors';
import { defineErrors } from '@errors';
import { debounce, throttle } from '@utils';

export class HookBus {
  private readonly hookMap = new Map<string, Hook<unknown>>();
  private readonly onHandlerError?: HookErrorHandler;

  constructor(errorBus?: ErrorBus) {
    this.onHandlerError = this.createErrorReporter(errorBus);
  }

  define<Payload>(name: HookName): Hook<Payload> & {
    debounce: (ms: number) => Hook<Payload>;
    throttle: (ms: number) => Hook<Payload>;
  } {
    const base = hook<Payload>(
      this.onHandlerError ? (err: unknown): void => this.onHandlerError?.(name, err) : undefined
    );

    this.storeHook(name, base as unknown as Hook<unknown>);
    return this.decorateWithUtilities(base);
  }

  get<Payload>(name: HookName): Hook<Payload> | undefined {
    return this.hookMap.get(name) as Hook<Payload> | undefined;
  }

  private storeHook(name: HookName, h: Hook<unknown>): void {
    this.hookMap.set(name, h);
  }

  private createErrorReporter(errorBus?: ErrorBus): HookErrorHandler | undefined {
    if (!errorBus) return undefined;
    const HooksErrors = defineErrors('hooks', { HandlerError: (e: unknown) => e });
    const { HandlerError } = HooksErrors.factories;
    return (name: string, err: unknown): void => {
      void errorBus.Throw(HandlerError(err), { source: 'hook', eventName: name });
    };
  }

  private withOn<Payload>(h: Hook<Payload>, onOverride: Hook<Payload>['on']): Hook<Payload> {
    return { ...h, on: onOverride };
  }

  private decorateWithUtilities<Payload>(h: Hook<Payload>): Hook<Payload> & {
    debounce: (ms: number) => Hook<Payload>;
    throttle: (ms: number) => Hook<Payload>;
  } {
    const withUtils = h as Hook<Payload> & {
      debounce: (ms: number) => Hook<Payload>;
      throttle: (ms: number) => Hook<Payload>;
    };

    withUtils.debounce = (ms: number): Hook<Payload> => {
      const originalOn = h.on;
      const debouncedOn: Hook<Payload>['on'] = handler =>
        originalOn(debounce(handler as (arg: unknown) => unknown, ms) as (p: Payload) => void);
      return this.withOn(h, debouncedOn);
    };

    withUtils.throttle = (ms: number): Hook<Payload> => {
      const originalOn = h.on;
      const throttledOn: Hook<Payload>['on'] = handler =>
        originalOn(throttle(handler as (arg: unknown) => unknown, ms) as (p: Payload) => void);
      return this.withOn(h, throttledOn);
    };

    return withUtils;
  }
}
