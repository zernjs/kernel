import { createKernel, definePlugin } from '../../src';
import { performance } from 'perf_hooks';

/**
 * Benchmark 02: Method Call Overhead
 *
 * Objectives:
 * - Measure the overhead of calling a method through the kernel plugins proxy/object vs direct function call.
 */

const ITERATIONS = 10_000_000;

const mathPlugin = definePlugin({
  name: 'math',
  version: '1.0.0',
  setup: () => ({
    add: (a: number, b: number) => a + b,
  }),
});

function rawAdd(a: number, b: number) {
  return a + b;
}

async function main() {
  console.log('=== BENCHMARK: METHOD CALL OVERHEAD ===');
  console.log(`Iterations: ${ITERATIONS.toLocaleString()}`);

  const kernel = await createKernel().use(mathPlugin).start();
  const pluginAdd = kernel.plugins.math.add;

  // Warmup
  for (let i = 0; i < 1000; i++) {
    rawAdd(i, i);
    pluginAdd(i, i);
  }

  // Test Raw
  const startRaw = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    rawAdd(i, i);
  }
  const endRaw = performance.now();
  const timeRaw = endRaw - startRaw;

  // Test Kernel Plugin Access
  const startPlugin = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    kernel.plugins.math.add(i, i); // Accessing property every time
  }
  const endPlugin = performance.now();
  const timePlugin = endPlugin - startPlugin;

  // Test Cached Plugin Access
  const startCached = performance.now();
  const cachedFn = kernel.plugins.math.add;
  for (let i = 0; i < ITERATIONS; i++) {
    cachedFn(i, i);
  }
  const endCached = performance.now();
  const timeCached = endCached - startCached;

  console.log(`\nResults:`);
  console.log(`Raw Function: ${timeRaw.toFixed(2)}ms`);
  console.log(`Kernel Access (kernel.plugins.math.add): ${timePlugin.toFixed(2)}ms`);
  console.log(`Cached Access (const fn = ...): ${timeCached.toFixed(2)}ms`);

  console.log(`\nOverhead (Kernel vs Raw): ${(timePlugin / timeRaw).toFixed(2)}x slower`);
  console.log(`Overhead (Cached vs Raw): ${(timeCached / timeRaw).toFixed(2)}x slower`);
}

main().catch(console.error);
