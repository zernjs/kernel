import { createKernel, definePlugin } from '../../src';
import { performance } from 'perf_hooks';

/**
 * Benchmark 01: Startup Stress Test
 *
 * Objectives:
 * - Measure initialization time with a large number of plugins.
 * - Measure memory consumption impact.
 */

const PLUGIN_COUNTS = [100, 1000, 5000];

function generatePlugins(count: number) {
  const plugins = [];
  for (let i = 0; i < count; i++) {
    plugins.push(
      definePlugin({
        name: `plugin-${i}`,
        version: '1.0.0',
        setup: () => ({
          id: i,
          doSomething: () => i * 2,
        }),
      })
    );
  }
  return plugins;
}

async function runTest(count: number) {
  console.log(`\n--- Testing with ${count} plugins ---`);

  const plugins = generatePlugins(count);

  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  const startTime = performance.now();

  let builder = createKernel();
  for (const p of plugins) {
    builder = builder.use(p);
  }

  const buildTime = performance.now();

  await builder.start();

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

  console.log(`Plugin Definition & Registration: ${(buildTime - startTime).toFixed(2)}ms`);
  console.log(`Kernel Initialization (Start): ${(endTime - buildTime).toFixed(2)}ms`);
  console.log(`Total Time: ${(endTime - startTime).toFixed(2)}ms`);
  console.log(`Memory Usage Increase: ${(endMemory - startMemory).toFixed(2)} MB`);
  console.log(`Average Time per Plugin: ${((endTime - startTime) / count).toFixed(4)}ms`);
}

async function main() {
  console.log('=== BENCHMARK: STARTUP STRESS ===');

  for (const count of PLUGIN_COUNTS) {
    await runTest(count);
    // Force GC if possible or just wait a bit? JS doesn't expose GC directly usually.
    // We'll just rely on new allocations.
    await new Promise(r => setTimeout(r, 100));
  }
}

main().catch(console.error);
