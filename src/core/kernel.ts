/**
 * @file Kernel orchestrates plugin lifecycle, plugins registry and errors.
 */
import { PluginRegistry } from '@core/registry';
import { createPluginAccessor } from '@core/accessor';
import type { KernelOptions, PluginInstance, PluginAccessor, ApplyAugmentsToPlugins } from '@types';
import { PLUGIN_SETUP_SYMBOL } from '@types';
import { resolvePluginOrder } from '@resolver';
import { LifecycleEngine, LifecycleEvents } from '@lifecycle';
import { ErrorBus, isKernelError, defineErrors, createErrorFactory } from '@errors';
import { createAugmenter, validateOptions } from '@plugin';
import { fromPromise } from '@utils';
import type { ErrorDef } from '@errors/types';

export class Kernel<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
  TErrorMap extends Record<string, Record<string, ErrorDef<unknown>>> = Record<never, never>,
> {
  public readonly plugins: PluginAccessor<ApplyAugmentsToPlugins<TPlugins, TAugments>>;
  private readonly registry: PluginRegistry;
  private _loadedPlugins: string[] = [];
  private readonly lifecycle = new LifecycleEngine();
  public readonly lifecycleEvents = new LifecycleEvents();
  public readonly errors = new ErrorBus();

  get loadedPlugins(): readonly string[] {
    return this._loadedPlugins;
  }

  constructor(registry?: PluginRegistry, options?: KernelOptions) {
    this.registry = registry ?? new PluginRegistry();
    this.plugins = createPluginAccessor<ApplyAugmentsToPlugins<TPlugins, TAugments>>(this.registry);
    void options;
  }

  use<T extends PluginInstance>(
    pluginCtor: new () => T,
    order?: { before?: string[]; after?: string[] }
  ): Kernel<TPlugins & Record<T['metadata']['name'], T>, TAugments, TErrorMap> {
    const instance = new pluginCtor();
    this.plugins.register(instance, order);
    return this as unknown as Kernel<
      TPlugins & Record<T['metadata']['name'], T>,
      TAugments,
      TErrorMap
    >;
  }

  async init(): Promise<void> {
    const all = this.plugins.list();
    const userOrder: Record<string, { before?: string[]; after?: string[] } | undefined> = {};
    for (const p of all) {
      userOrder[p.metadata.name] = this.plugins.getLoadOrder(p.metadata.name);
    }
    const resolved = resolvePluginOrder({ plugins: all, userOrder });

    try {
      const targets = await this.runSetupAndCollectTargets(resolved);
      this.applyAugmentTargets(targets);

      await this.lifecycle.runPhase('init', resolved, this);
      await this.lifecycle.runPhase('afterInit', resolved, this);

      this._loadedPlugins = resolved.map(p => p.metadata.name);
      for (const p of resolved)
        await this.lifecycleEvents.emit('pluginLoaded', { name: p.metadata.name });
    } catch (err) {
      await this.handleInitError(err);
      await this.lifecycleEvents.emit('pluginFailed', { name: 'unknown', error: err });
      throw err;
    }
  }

  async destroy(): Promise<void> {
    const all = this.plugins.list().slice().reverse();
    await this.lifecycle.runPhase('beforeDestroy', all, this);
    await this.lifecycle.runPhase('destroy', all, this);
    await this.lifecycle.runPhase('afterDestroy', all, this);
    this.plugins.clear();
    this._loadedPlugins = [];
  }

  private async runSetupAndCollectTargets(
    resolved: PluginInstance[]
  ): Promise<Record<string, object>> {
    const targets: Record<string, object> = {};
    const extend = createAugmenter(targets);

    await this.lifecycle.runPhase('beforeInit', resolved, this);

    for (const p of resolved) {
      const setup = (p as unknown as { [k: symbol]: unknown })[PLUGIN_SETUP_SYMBOL] as
        | ((ctx: unknown, options?: unknown) => unknown | Promise<unknown>)
        | undefined;

      if (setup) {
        const ctx = this.buildSetupContext(p, extend);
        const pluginOptionsSpec = (p as unknown as { options?: unknown }).options as
          | Parameters<typeof validateOptions>[0]
          | undefined;
        const validatedOptions = validateOptions(pluginOptionsSpec, undefined);
        const apiResult = await fromPromise(
          Promise.resolve(setup(ctx, validatedOptions) as Promise<unknown>)
        );
        if (apiResult.ok !== true) {
          throw apiResult.error;
        }
        const api = apiResult.value;
        const selfInstance = (this.plugins as unknown as Record<string, unknown>)[
          p.metadata.name
        ] as unknown;
        if (selfInstance) Object.assign(selfInstance as unknown as object, api as object);
        targets[p.metadata.name] = api as object;
      }

      const aug = (p as unknown as { augments?: Partial<Record<string, Record<string, unknown>>> })
        .augments;
      if (aug) {
        for (const [target, api] of Object.entries(aug)) extend(target, api!);
      }
    }

    return targets;
  }

  private buildSetupContext(
    p: PluginInstance,
    extend: (target: string, api: Record<string, unknown>) => void
  ): {
    kernel: Kernel<TPlugins, TAugments, TErrorMap>;
    errors: ErrorBus;
    plugins: Record<string, unknown>;
    use: (name: string) => unknown;
    extend: (target: string, api: Record<string, unknown>) => void;
  } {
    const ctor = (p as unknown as { constructor: { dependsOn?: Array<new () => PluginInstance> } })
      .constructor;
    const depCtors: Array<new () => PluginInstance> = ctor.dependsOn ?? [];
    const depPlugins: Record<string, unknown> = {};
    for (const dCtor of depCtors) {
      const depName = new dCtor().metadata.name;
      const inst = (this.plugins as unknown as Record<string, unknown>)[depName] as unknown;
      if (inst) depPlugins[depName] = inst as unknown as object;
    }
    return {
      kernel: this,
      errors: this.errors,
      plugins: depPlugins,
      use: (name: string): unknown => depPlugins[name],
      extend: (target: string, api: Record<string, unknown>): void => extend(target, api),
    } as const;
  }

  private applyAugmentTargets(targets: Record<string, object>): void {
    for (const [name, api] of Object.entries(targets)) {
      const inst = (this.plugins as unknown as Record<string, unknown>)[name] as unknown;
      if (inst) Object.assign(inst as unknown as object, api);
    }
  }

  private async handleInitError(err: unknown): Promise<void> {
    if (isKernelError(err)) {
      const KernelCodeFactory = createErrorFactory<typeof err, typeof err.code>('kernel', err.code);
      await this.errors.report(KernelCodeFactory(err), { source: 'lifecycle' });
      return;
    }
    const { UnknownError: LocalUnknownError } = defineErrors('kernel', {
      UnknownError: (e: unknown) => e,
    }).factories;
    await this.errors.report(LocalUnknownError(err), { source: 'lifecycle' });
  }
}
