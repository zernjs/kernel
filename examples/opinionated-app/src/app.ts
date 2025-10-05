/**
 * @file Application class
 * @description Main application orchestration
 */

import { createKernel, type Kernel } from '../../../src';
import { appConfig } from './config';
import { loggerPlugin, databasePlugin, usersPlugin, monitoringPlugin } from './plugins';
import { formatUser } from './utils';
import type { User } from './types';

export class App {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private kernel: Kernel<any> | null = null;

  async start(): Promise<void> {
    console.log(`\n🚀 Starting ${appConfig.name} v${appConfig.version}`);
    console.log(`📦 Environment: ${appConfig.environment}\n`);

    // Initialize kernel with all plugins
    this.kernel = await createKernel()
      // Core plugins
      .use(loggerPlugin)
      .use(databasePlugin)

      // Feature plugins
      .use(usersPlugin)
      .use(monitoringPlugin)

      // Start kernel
      .start();

    const logger = this.kernel.get('logger');
    const db = this.kernel.get('database');

    logger.info('Application started successfully!');

    // Connect to database
    await db.connect();
  }

  async run(): Promise<void> {
    if (!this.kernel) {
      throw new Error('Application not started. Call start() first.');
    }

    const logger = this.kernel.get('logger');
    const users = this.kernel.get('users');

    try {
      logger.info('Running application logic...');

      // Create some users
      const user1 = await users.create({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        role: 'admin' as any,
      });
      logger.info(`User created: ${formatUser(user1)}`);

      const user2 = await users.create({
        name: 'Bob Smith',
        email: 'bob@example.com',
      });
      logger.info(`User created: ${formatUser(user2)}`);

      // Find users
      const foundUser = await users.findByEmail('alice@example.com');
      if (foundUser) {
        logger.info(`Found user: ${formatUser(foundUser)}`);
      }

      // Update user
      const updated = await users.update(user1.id, { name: 'Alice Williams' });
      if (updated) {
        logger.info(`User updated: ${formatUser(updated)}`);
      }

      // List all users
      const allUsers = await users.findAll();
      logger.info(`Total users: ${allUsers.length}`);
      allUsers.forEach((user: User) => {
        logger.info(`  - ${formatUser(user)}`);
      });

      logger.info('Application logic completed!');
    } catch (error) {
      logger.error('Application error:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.kernel) return;

    const logger = this.kernel.get('logger');
    const db = this.kernel.get('database');
    const monitoring = this.kernel.get('monitoring');

    logger.info('Shutting down application...');

    // Stop monitoring
    monitoring.stop();

    // Disconnect from database
    await db.disconnect();

    // Shutdown kernel
    await this.kernel.shutdown();

    logger.info('Application shutdown complete.');
    console.log('\n✨ Goodbye!\n');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getKernel(): Kernel<any> {
    if (!this.kernel) {
      throw new Error('Application not started');
    }
    return this.kernel;
  }
}
