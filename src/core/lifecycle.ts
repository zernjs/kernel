/* eslint-disable @typescript-eslint/no-explicit-any */
import { KernelHooks } from './types';

/**
 * Manages the registration and execution of lifecycle hooks.
 * Supports both synchronous and asynchronous execution modes.
 *
 * Now supports Generic Hooks for extensibility.
 */
export class LifecycleManager<Hooks = KernelHooks> {
  // We use 'any' here for internal storage because Typescript cannot index dynamically
  // properly with generics in a private property without casting.
  private hooks: Record<string, ((...args: any[]) => any)[]> = {
    onInit: [],
    onPluginSetup: [],
    onPluginReady: [],
    onPluginError: [],
    onTeardown: [],
  };

  /**
   * Registers a handler for a specific lifecycle hook.
   *
   * @param hook - The name of the hook to subscribe to.
   * @param handler - The function to execute when the hook is triggered.
   */
  on<K extends keyof Hooks>(hook: K, handler: Hooks[K]): void {
    const hookName = hook as string;
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(handler as any);
  }

  /**
   * Emits a hook event synchronously (Alias for emitSync).
   *
   * @param hook - The name of the hook to emit.
   * @param args - Arguments to pass to the handlers.
   */
  emit<K extends keyof Hooks>(
    hook: K,
    ...args: Hooks[K] extends (...args: any[]) => any ? Parameters<Hooks[K]> : any[]
  ): void {
    this.emitSync(hook, ...(args as any));
  }

  /**
   * Emits a hook event asynchronously.
   * Handlers are executed sequentially.
   *
   * @param hook - The name of the hook to emit.
   * @param args - Arguments to pass to the handlers.
   */
  async emitAsync<K extends keyof Hooks>(
    hook: K,
    ...args: Hooks[K] extends (...args: any[]) => any ? Parameters<Hooks[K]> : any[]
  ): Promise<void> {
    const hookName = hook as string;
    const handlers = this.hooks[hookName] || [];
    for (const handler of handlers) {
      await handler(...args);
    }
  }

  /**
   * Emits a hook event synchronously.
   * Handlers are executed sequentially.
   * Throws an error if any handler returns a Promise.
   *
   * @param hook - The name of the hook to emit.
   * @param args - Arguments to pass to the handlers.
   */
  emitSync<K extends keyof Hooks>(
    hook: K,
    ...args: Hooks[K] extends (...args: any[]) => any ? Parameters<Hooks[K]> : any[]
  ): void {
    const hookName = hook as string;
    const handlers = this.hooks[hookName] || [];
    for (const handler of handlers) {
      const result = handler(...args);
      if (result instanceof Promise) {
        throw new Error(
          `Lifecycle Hook '${hookName}' returned a Promise in a synchronous execution context.`
        );
      }
    }
  }
}
