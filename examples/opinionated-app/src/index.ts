/**
 * @file Application entry point
 * @description Initialize and run the application
 */

import { App } from './app';

async function main(): Promise<void> {
  const app = new App();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n⚠️ Received SIGINT, shutting down gracefully...');
    await app.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n⚠️ Received SIGTERM, shutting down gracefully...');
    await app.stop();
    process.exit(0);
  });

  try {
    // Start application
    await app.start();

    // Run application logic
    await app.run();

    // Stop application
    await app.stop();
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    await app.stop();
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
