import { createKernel, definePlugin } from '../../src';
import { performance } from 'perf_hooks';

/**
 * Benchmark 03: Hook System Stress
 *
 * Objectives:
 * - Measure performance of the event emitter system with many listeners.
 */

const LISTENER_COUNTS = [10, 100, 1000];
const EMIT_COUNT = 100_000;

async function runTest(listenerCount: number) {
  console.log(
    `\n--- Testing with ${listenerCount} listeners, ${EMIT_COUNT.toLocaleString()} emits ---`
  );

  const emitterPlugin = definePlugin({
    name: 'emitter',
    version: '1.0.0',
    events: {} as { ping: (n: number) => void },
    setup: ctx => ({
      trigger: () => {
        for (let i = 0; i < EMIT_COUNT; i++) {
          ctx.hooks.emit('ping', i);
        }
      },
    }),
  });

  const listeners = [];
  for (let i = 0; i < listenerCount; i++) {
    listeners.push(
      definePlugin({
        name: `listener-${i}`,
        version: '1.0.0',
        dependencies: [emitterPlugin],
        setup: ctx => {
          ctx.hooks.on('ping', n => {
            // simple op
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const res = n + 1;
          });
          return {};
        },
      })
    );
  }

  let builder = createKernel().use(emitterPlugin);
  for (let l of listeners) builder = builder.use(l);

  const kernel = await builder.start();

  const start = performance.now();
  kernel.plugins.emitter.trigger();
  const end = performance.now();

  const totalOps = listenerCount * EMIT_COUNT;
  const time = end - start;

  console.log(`Total Time: ${time.toFixed(2)}ms`);
  console.log(`Throughput: ${(totalOps / (time / 1000)).toFixed(0)} listener-calls/sec`);
  console.log(`Avg time per emit (all listeners): ${(time / EMIT_COUNT).toFixed(4)}ms`);
}

async function main() {
  console.log('=== BENCHMARK: HOOK SYSTEM STRESS ===');

  for (const count of LISTENER_COUNTS) {
    await runTest(count);
  }
}

main().catch(console.error);
