/*
  Simple throughput benchmark for EventBus emit/on path.
  Note: This is a lightweight, in-repo script (not a full benchmarking suite).
*/
import { EventBus } from '../../src/events/event-bus';
import { performance } from 'node:perf_hooks';

async function run(): Promise<void> {
  const bus = new EventBus();
  const ns = bus.namespace('bench');
  ns.define('tick', { delivery: 'sync', startup: 'drop' });

  ns.on('tick', () => {
    // handler work
  });

  const N = 1_000_000;
  const start = performance.now();
  for (let i = 0; i < N; i++) ns.emit('tick', {});
  const end = performance.now();

  console.log(
    `Emitted ${N} events in ${(end - start).toFixed(2)}ms → ${(N / (end - start)).toFixed(2)} ev/ms`
  );
}

void run();
