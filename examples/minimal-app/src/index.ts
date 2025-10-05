/**
 * @file Application entry point
 * @description Initialize kernel and start application
 */

import { createKernel } from '../../../src';
import { config } from './config';
import { loggerPlugin, databasePlugin } from './plugins';

async function main(): Promise<void> {
  console.log(`🚀 Starting ${config.app.name} v${config.app.version}`);
  console.log(`📦 Environment: ${config.app.environment}\n`);

  // Initialize kernel with plugins
  const kernel = await createKernel().use(loggerPlugin).use(databasePlugin).start();

  // Get plugin instances
  const logger = kernel.get('logger');
  const db = kernel.get('database');

  // Application logic
  try {
    logger.info('Application started successfully!');

    // Connect to database
    await db.connect();
    logger.info('Database connected!');

    // Example: Create a user
    const user = await db.users.create({
      name: 'John Doe',
      email: 'john@example.com',
    });
    logger.info('User created:', user);

    // Example: Find user by ID
    const foundUser = await db.users.findById(user.id);
    logger.info('User found:', foundUser);

    // Simulate some work
    logger.debug('Processing some work...');

    logger.info('All tasks completed!');
  } catch (error) {
    logger.error('Application error:', error);
    throw error;
  } finally {
    // Cleanup
    await db.disconnect();
    await kernel.shutdown();
    logger.info('Application shutdown complete.');
  }
}

// Run application
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
