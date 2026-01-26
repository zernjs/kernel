import { describe, it, expect } from 'vitest';
import { createKernel, definePlugin } from '../src';

describe('Zern Kernel v2', () => {
  it('should initialize simple plugins correctly', async () => {
    const p1 = definePlugin({
      name: 'math',
      version: '1.0.0',
      setup: () => ({
        add: (a: number, b: number) => a + b,
      }),
    });

    const kernel = await createKernel().use(p1).start();

    expect(kernel.plugins.math).toBeDefined();
    expect(kernel.plugins.math.add(2, 3)).toBe(5);
  });

  it('should handle dependencies and augmentation', async () => {
    // 1. Base Plugin
    const db = definePlugin({
      name: 'db',
      version: '1.0.0',
      setup: () => ({
        data: [] as string[],
        add: (item: string) => {
          /* logic */
        },
      }),
    });

    // 2. Extending Plugin
    const auth = definePlugin({
      name: 'auth',
      version: '1.0.0',
      dependencies: [db],
      setup: ctx => {
        // Runtime verification: Dependency should be available
        if (!ctx.plugins.db) throw new Error('DB missing');

        return {
          api: {
            login: (user: string) => {
              ctx.plugins.db.data.push(user);
              return true;
            },
          },
          extensions: {
            db: {
              // Augmenting DB with new method
              hasUser: (user: string) => ctx.plugins.db.data.includes(user),
            },
          },
        };
      },
    });

    const kernel = await createKernel().use(db).use(auth).start();

    // Check Logic
    expect(kernel.plugins.auth.login('vini')).toBe(true);
    expect(kernel.plugins.db.data).toContain('vini');

    // Check Augmentation (Runtime)
    // In a real TS environment, this would be typed!
    const dbAny = kernel.plugins.db as any;
    expect(dbAny.hasUser).toBeDefined();
    expect(dbAny.hasUser('vini')).toBe(true);
    expect(dbAny.hasUser('nobody')).toBe(false);
  });

  it('should resolve circular dependencies order or throw', async () => {
    // Note: Our simple topo sort throws on circular deps
    const p1 = definePlugin({ name: 'p1', version: '1.0.0', dependencies: [], setup: () => ({}) });
    // Fake circular structure for test
    (p1 as any).dependencies = [{ name: 'p1' }];

    const builder = createKernel().use(p1);

    await expect(builder.start()).rejects.toThrow('Circular dependency');
  });
});
