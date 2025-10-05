/**
 * @file Monitoring plugin
 * @description Application monitoring and metrics
 */

import { plugin } from '../../../../../src';
import { loggerPlugin } from '../core/logger.plugin';
import { env } from '../../config';

interface PluginStats {
  callCount: number;
  errorCount: number;
  lastCalled: Date | null;
}

export const monitoringPlugin = plugin('monitoring', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .metadata({
    author: 'Opinionated App',
    description: 'Application monitoring and metrics',
    enabled: env.ENABLE_MONITORING,
    interval: env.MONITORING_INTERVAL,
  })
  .onInit(({ plugins }) => {
    if (env.ENABLE_MONITORING) {
      plugins.logger.info('Monitoring enabled - tracking all plugin operations');
    }
  })
  .setup(({ plugins }) => {
    const stats = new Map<string, PluginStats>();

    // Periodic stats reporting
    // eslint-disable-next-line no-undef
    let intervalId: NodeJS.Timeout | null = null;

    if (env.ENABLE_MONITORING) {
      intervalId = setInterval(() => {
        plugins.logger.info('📊 Monitoring stats:', Object.fromEntries(stats));
      }, env.MONITORING_INTERVAL);
    }

    return {
      recordCall(plugin: string, method: string): void {
        const key = `${plugin}.${method}`;
        const existing = stats.get(key) || { callCount: 0, errorCount: 0, lastCalled: null };

        stats.set(key, {
          callCount: existing.callCount + 1,
          errorCount: existing.errorCount,
          lastCalled: new Date(),
        });
      },

      recordError(plugin: string, method: string): void {
        const key = `${plugin}.${method}`;
        const existing = stats.get(key) || { callCount: 0, errorCount: 0, lastCalled: null };

        stats.set(key, {
          callCount: existing.callCount,
          errorCount: existing.errorCount + 1,
          lastCalled: existing.lastCalled,
        });
      },

      getStats(): Record<string, PluginStats> {
        return Object.fromEntries(stats);
      },

      clearStats(): void {
        stats.clear();
        plugins.logger.info('Monitoring stats cleared');
      },

      stop(): void {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
          plugins.logger.info('Monitoring stopped');
        }
      },
    };
  });
