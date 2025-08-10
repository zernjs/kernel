import { createKernel } from '../../src/core/createKernel';
import { definePlugin } from '../../src/plugin/definePlugin';
import { performance } from 'node:perf_hooks';

const P = definePlugin({
  name: 'noop',
  version: '1.0.0',
  async setup() {
    return {};
  },
});

async function run(): Promise<void> {
  const kernel = createKernel().use(P).build();
  const start = performance.now();
  await kernel.init();
  const end = performance.now();
  console.log(`kernel.init() time: ${(end - start).toFixed(2)}ms`);
}

void run();
