import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import { createEvents, event } from '@events/event-bus';
import { definePlugin } from '@plugin/definePlugin';
import { defineErrors } from '@errors';

describe('EventBus → ErrorBus routing', () => {
  it('routes handler exceptions to ErrorBus with metadata', async () => {
    const P = definePlugin({
      name: 'p',
      version: '1.0.0',
      events: createEvents('p', {
        boom: event(),
      }),
      async setup() {
        return {};
      },
    });

    const kernel = createKernel().use(P).build();
    const ns = kernel.events.namespace('p');
    const EventsErrors = defineErrors('events', { HandlerError: (e: unknown) => e });
    const { HandlerError } = EventsErrors.factories;
    let routed = false;
    const offErr = kernel.errors.on(HandlerError, (_e, meta) => {
      routed = meta?.namespace === 'p' && meta?.eventName === 'boom';
    });

    ns.on('boom', () => {
      throw new Error('handler exploded');
    });

    await kernel.init();
    await ns.emit('boom', {});

    // routing happens async; microtask flush
    await Promise.resolve();

    expect(routed).toBe(true);
    offErr();
  });
});
