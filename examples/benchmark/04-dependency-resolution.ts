import { createKernel, definePlugin } from '../../src';
import { performance } from 'perf_hooks';

/**
 * Benchmark 04: Dependency Resolution Chain
 *
 * Objectives:
 * - Measure dependency resolution performance with deep dependency chains.
 * A -> B -> C -> ... -> Z
 */

const CHAIN_LENGTHS = [10, 50, 100];

function generateChain(length: number) {
  const plugins = [];

  // Create leaf
  plugins.push(
    definePlugin({
      name: 'plugin-0',
      version: '1.0.0',
      setup: () => ({ val: 0 }),
    })
  );

  for (let i = 1; i < length; i++) {
    const prevPlugin = plugins[i - 1];
    plugins.push(
      definePlugin({
        name: `plugin-${i}`,
        version: '1.0.0',
        dependencies: [prevPlugin],
        setup: ctx => ({ val: i }),
      })
    );
  }

  return plugins; // Reverse or shuffle? The resolver should handle any order.
}

async function runTest(length: number) {
  console.log(`\n--- Testing Dependency Chain of Length ${length} ---`);

  // Shuffle to force resolver to work
  const plugins = generateChain(length).sort(() => Math.random() - 0.5);

  const start = performance.now();

  let builder = createKernel();
  for (const p of plugins) builder = builder.use(p);

  await builder.start();

  const end = performance.now();

  console.log(`Resolution & Init Time: ${(end - start).toFixed(2)}ms`);
}

async function main() {
  console.log('=== BENCHMARK: DEPENDENCY RESOLUTION ===');
  for (const len of CHAIN_LENGTHS) {
    await runTest(len);
  }
}

main().catch(console.error);
