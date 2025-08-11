import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';
import { definePlugin } from '@plugin/definePlugin';

describe('Augmentations', () => {
  it('applies declarative and programmatic augments', async () => {
    const Database = definePlugin({
      name: 'database',
      version: '1.0.0',
      async setup(): Promise<{ connect(): Promise<void>; isConnected(): boolean }> {
        let connected = false;
        return {
          async connect(): Promise<void> {
            connected = true;
          },
          isConnected(): boolean {
            return connected;
          },
        };
      },
    });

    const Utils = definePlugin({
      name: 'utils',
      version: '1.0.0',
      augments: {
        database: {
          async backup(this: unknown, name: string) {
            return `backup:${name}`;
          },
          async optimize(): Promise<string> {
            return 'ok';
          },
        },
      },
      async setup(): Promise<Record<string, never>> {
        return {};
      },
    });

    const kernel = createKernel().use(Database).use(Utils).build();
    await kernel.init();

    const db = kernel.plugins.database;
    expect(typeof db.backup).toBe('function');
    expect(typeof db.optimize).toBe('function');
    expect(await db.backup('daily')).toBe('backup:daily');
    expect(await db.optimize()).toBe('ok');
  });
});
