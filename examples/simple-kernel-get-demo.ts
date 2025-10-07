/**
 * Simple demonstration of kernel.get() returning $meta and $store
 */

import { plugin, createKernel } from '@/index';

// Create a simple logger plugin
const loggerPlugin = plugin('logger', '1.0.0')
  .metadata({ author: 'Zern Team' })
  .store(() => ({ count: 0 }))
  .setup(({ store }) => ({
    log: (msg: string) => {
      store.count++;
      console.log(`[LOG] ${msg}`);
    },
  }));

// Start kernel and get plugin
async function main() {
  const kernel = await createKernel().use(loggerPlugin).start();

  // Get plugin with $meta and $store
  const logger = kernel.get('logger');

  console.log('\n✅ kernel.get() now returns:');
  console.log('  - API methods:', typeof logger.log); // 'function'
  console.log('  - $meta:', logger.$meta); // { name, version, author }
  console.log('  - $store:', typeof logger.$store); // 'object' with reactive properties

  console.log('\n📊 Accessing plugin info:');
  console.log('  - logger.$meta.name:', logger.$meta.name); // 'logger'
  console.log('  - logger.$meta.version:', logger.$meta.version); // '1.0.0'
  console.log('  - logger.$meta.author:', logger.$meta.author); // 'Zern Team'
  console.log('  - logger.$store.count:', logger.$store.count); // 0

  console.log('\n🔄 Using the plugin:');
  logger.log('Hello World!');
  console.log('  - logger.$store.count:', logger.$store.count); // 1

  // Watch store changes
  logger.$store.watch('count', change => {
    console.log(`  [WATCHER] count changed: ${change.oldValue} → ${change.newValue}`);
  });

  logger.log('Another message');
  console.log('  - logger.$store.count:', logger.$store.count); // 2

  console.log('\n✨ Done!\n');

  await kernel.shutdown();
}

main().catch(console.error);
