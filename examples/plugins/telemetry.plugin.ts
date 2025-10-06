/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Telemetry Plugin Example
 * Demonstrates how to create a telemetry plugin that captures errors from all plugins
 */

import { plugin, ZernError } from '../../src';

export interface TelemetryOptions {
  sentry?: {
    dsn: string;
    environment?: string;
  };
  datadog?: {
    apiKey: string;
    service?: string;
  };
  custom?: (error: ZernError) => Promise<void>;
}

export function createTelemetryPlugin(options: TelemetryOptions) {
  const errors: ZernError[] = [];
  let errorCount = 0;
  let lastError: ZernError | null = null;

  return plugin('telemetry', '1.0.0')
    .proxy('**', {
      onError: async (error, ctx) => {
        const zernError = error instanceof ZernError ? error : null;

        if (zernError) {
          zernError.context.plugin = ctx.plugin;
          zernError.context.method = ctx.method;

          errorCount++;
          lastError = zernError;
          errors.push(zernError);

          if (options.sentry) {
            await sendToSentry(zernError, options.sentry);
          }

          if (options.datadog) {
            await sendToDatadog(zernError, options.datadog);
          }

          if (options.custom) {
            await options.custom(zernError);
          }
        }

        throw error;
      },
    })
    .setup(() => ({
      getMetrics: () => ({
        totalErrors: errorCount,
        lastError,
        recentErrors: errors.slice(-10),
      }),
      clearErrors: () => {
        errors.length = 0;
      },
    }));
}

async function sendToSentry(error: ZernError, config: { dsn: string; environment?: string }) {
  console.log(`[SENTRY] Sending error to ${config.dsn}:`, {
    code: error.code,
    message: error.message,
    context: error.context,
    environment: config.environment,
  });
}

async function sendToDatadog(error: ZernError, config: { apiKey: string; service?: string }) {
  console.log(`[DATADOG] Sending error:`, {
    code: error.code,
    message: error.message,
    service: config.service,
    context: error.context,
  });
}
