import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import { createEvents, event } from '@events/event-bus';
import { definePlugin } from '@plugin/definePlugin';

describe('EventBus basic', () => {
  it('declares events via plugin and emits/consumes with startup buffering', async () => {
    const Analytics = definePlugin({
      name: 'analytics',
      version: '1.0.0',
      events: createEvents('analytics', {
        pageView: event({
          delivery: 'microtask',
          startup: 'buffer',
          bufferSize: 10,
        }),
      }),
      async setup() {
        return {};
      },
    });

    const kernel = createKernel()
      .withOptions({
        events: {
          // Explicitly include default node adapter (it's on by default, but we exercise the config path)
          adapters: ['node'],
        },
      })
      .use(Analytics)
      .build();

    // subscribe before init (will buffer until bus starts)
    const ns = kernel.events.namespace('analytics');
    let received: string | null = null;
    const off = ns.on('pageView', (p: { path: string }) => {
      received = p.path;
    });

    // emit before init (should be buffered)
    await ns.emit('pageView', { path: '/home' });

    await kernel.init();
    // after init/start, buffered emissions are delivered
    expect(received).toBe('/home');
    off();
  });
});
