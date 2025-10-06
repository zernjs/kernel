/**
 * Error Handling System Demo
 * Demonstrates the complete error handling capabilities of Zern Kernel
 */

import {
  plugin,
  createKernel,
  solution,
  developmentConfig,
  ErrorSeverity,
  ValidationError,
} from '../src';
import { createTelemetryPlugin } from './plugins/telemetry.plugin';
import { createRetryPlugin } from './plugins/retry.plugin';
import { createErrorBoundaryPlugin } from './plugins/error-boundary.plugin';

class UserNotFoundError extends ValidationError {
  constructor(userId: string) {
    super(
      { userId },
      {
        severity: ErrorSeverity.ERROR,
        solutions: [
          solution('Check the user ID', 'The ID might be incorrect'),
          solution('User may have been deleted', 'Check the database'),
        ],
      }
    );
    this.message = `User not found: ${userId}`;
  }
}

const apiPlugin = plugin('api', '1.0.0')
  .config({
    errors: {
      showSolutions: true,
      severity: ErrorSeverity.WARN,
    },
  })
  .setup(() => ({
    fetchUser: (userId: string): { id: string; name: string; email: string } => {
      if (userId === '404') {
        throw new UserNotFoundError(userId);
      }
      return { id: userId, name: 'John Doe', email: 'john@example.com' };
    },
    flakeyOperation: (shouldFail: boolean): string => {
      if (shouldFail) {
        throw new Error('Temporary failure');
      }
      return 'success';
    },
  }))
  .onError((error, ctx) => {
    console.log(`[API] Error in ${ctx.phase}/${ctx.method}:`, error.message);
  });

const databasePlugin = plugin('database', '1.0.0')
  .depends(apiPlugin, '^1.0.0')
  .setup(({ plugins }) => ({
    getUser: (userId: string): { id: string; name: string; email: string } => {
      return plugins.api.fetchUser(userId);
    },
    simulateNetworkError: (): void => {
      throw new Error('Network timeout');
    },
  }))
  .onError((error, ctx) => {
    console.log(`[DATABASE] Error in ${ctx.phase}:`, error.message);
  });

async function main(): Promise<void> {
  console.log('🔥 Zern Kernel - Error Handling Demo\n');

  const kernel = await createKernel()
    .config({
      ...developmentConfig(),
      errors: {
        showSolutions: true,
        enableColors: true,
        showContext: true,
        captureStackTrace: true,
      },
    })
    .use(
      createTelemetryPlugin({
        custom: async error => {
          console.log(`[TELEMETRY] Error captured:`, {
            code: error.code,
            message: error.message,
            context: error.context,
          });
        },
      })
    )
    .use(
      createRetryPlugin({
        maxAttempts: 3,
        backoff: 'exponential',
        shouldRetry: (error: Error): boolean => {
          return error.message.includes('Temporary') || error.message.includes('Network');
        },
        onRetry: (attempt, error) => {
          console.log(`[RETRY] Attempt ${attempt} failed:`, error.message);
        },
      })
    )
    .use(
      createErrorBoundaryPlugin({
        fallback: {
          'api.fetchUser': { id: 'unknown', name: 'Unknown User', email: '' },
        },
        onError: (error, ctx) => {
          console.log(`[BOUNDARY] Caught error in ${ctx.plugin}.${ctx.method}`);
        },
      })
    )
    .use(apiPlugin)
    .use(databasePlugin)
    .start();

  const api = kernel.get('api');
  const telemetry = kernel.get('telemetry');
  const retry = kernel.get('retry');
  const boundary = kernel.get('error-boundary');

  console.log('1️⃣  Testing successful operation:\n');
  const user1 = await api.fetchUser('123');
  console.log('User:', user1);
  console.log();

  console.log('2️⃣  Testing error with fallback (error boundary):\n');
  try {
    const user2 = await api.fetchUser('404');
    console.log('User (fallback):', user2);
  } catch (err) {
    console.log('Caught error (expected):', (err as Error).message);
  }
  console.log();

  console.log('3️⃣  Testing retry mechanism:\n');
  try {
    const result = await api.flakeyOperation(true);
    console.log('Flakey operation result:', result);
  } catch {
    console.log('Retry failed as expected after max attempts');
  }
  console.log();

  console.log('4️⃣  Testing telemetry metrics:\n');
  const metrics = await telemetry.getMetrics();
  console.log('Telemetry Metrics:', metrics);
  console.log();

  console.log('5️⃣  Testing retry stats:\n');
  const retryStats = await retry.getStats();
  console.log('Retry Stats:', retryStats);
  console.log();

  console.log('6️⃣  Testing error boundary stats:\n');
  const boundaryErrors = await boundary.getRecentErrors(5);
  console.log(
    'Recent Errors:',
    boundaryErrors.map(e => ({
      plugin: e.plugin,
      method: e.method,
      error: e.error.message,
    }))
  );
  console.log();

  await kernel.shutdown();
  console.log('✨ Demo completed!\n');
}

main().catch(console.error);
