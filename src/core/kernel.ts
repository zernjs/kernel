/**
 * @file Kernel orchestrates plugin lifecycle, events, hooks, errors and alerts.
 */
import { EventEmitter } from 'node:events';
import { PluginRegistry } from '@core/registry';
import { createPluginAccessor } from '@core/accessor';
import type { KernelOptions, PluginInstance, PluginAccessor, ApplyAugmentsToPlugins } from '@types';
import { PLUGIN_SETUP_SYMBOL } from '@types';
import { resolvePluginOrder } from '@resolver';
import { LifecycleEngine, LifecycleEvents } from '@lifecycle';
import { HookBus } from '@hooks';
import { EventBus } from '@events';
import type { EventDef, TypedEvents } from '@types';
import type { AlertDef } from '@alerts/types';
import type { TypedAlerts as TypedAlertsAlerts } from '@alerts/types';
import { createNodeEventEmitterAdapter } from '@events/adapters';
import { createRxjsAdapter } from '@events/adapters';
import { ErrorBus, isKernelError, defineErrors, createErrorFactory } from '@errors';
import { AlertBus, bindAlerts } from '@alerts';
import { createAugmenter, validateOptions } from '@plugin';
import { fromPromise } from '@utils';

type DeclaredHooksShape = Record<
  string,
  { on: unknown; off: unknown; emit: unknown; once: unknown }
>;
type DeclaredEventsShape = {
  namespace: string;
  spec: Record<
    string,
    { __type: 'event-def'; options?: { delivery?: string; startup?: string; bufferSize?: number } }
  >;
};

export class Kernel<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
  TEventMap extends Record<string, Record<string, EventDef>> = Record<never, never>,
  TAlertMap extends Record<string, Record<string, AlertDef>> = Record<never, never>,
> {
  public readonly plugins: PluginAccessor<ApplyAugmentsToPlugins<TPlugins, TAugments>>;
  private readonly registry: PluginRegistry;
  private _loadedPlugins: string[] = [];
  private readonly lifecycle = new LifecycleEngine();
  public readonly lifecycleEvents = new LifecycleEvents();
  public readonly hooks: HookBus;
  public readonly events: TypedEvents<TEventMap> =
    new EventBus() as unknown as TypedEvents<TEventMap>;
  public readonly errors = new ErrorBus();
  public readonly alerts: AlertBus & TypedAlertsAlerts<TAlertMap> =
    new AlertBus() as unknown as AlertBus & TypedAlertsAlerts<TAlertMap>;

  get loadedPlugins(): readonly string[] {
    return this._loadedPlugins;
  }

  constructor(registry?: PluginRegistry, options?: KernelOptions) {
    this.registry = registry ?? new PluginRegistry();
    this.plugins = createPluginAccessor<ApplyAugmentsToPlugins<TPlugins, TAugments>>(this.registry);
    this.hooks = new HookBus(this.errors);

    this.setupEventErrorRouting();
    this.configureEventAdapters(options);
  }

  use<T extends PluginInstance>(
    pluginCtor: new () => T,
    order?: { before?: string[]; after?: string[] }
  ): Kernel<TPlugins & Record<T['metadata']['name'], T>> {
    const instance = new pluginCtor();
    this.plugins.register(instance, order);
    return this as unknown as Kernel<TPlugins & Record<T['metadata']['name'], T>>;
  }

  async init(): Promise<void> {
    const all = this.plugins.list();
    const userOrder: Record<string, { before?: string[]; after?: string[] } | undefined> = {};
    for (const p of all) {
      userOrder[p.metadata.name] = this.plugins.getLoadOrder(p.metadata.name);
    }
    const resolved = resolvePluginOrder({ plugins: all, userOrder });

    try {
      this.registerDeclaratives(resolved);
      this.events.start();

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

  // removed legacy get API in favor of `kernel.plugins.<name>`

  async destroy(): Promise<void> {
    const all = this.plugins.list().slice().reverse();
    await this.lifecycle.runPhase('beforeDestroy', all, this);
    await this.lifecycle.runPhase('destroy', all, this);
    await this.lifecycle.runPhase('afterDestroy', all, this);
    this.plugins.clear();
    this._loadedPlugins = [];
  }

  private setupEventErrorRouting(): void {
    const EventsErrors = defineErrors('events', {
      HandlerError: (e: unknown) => e,
    });
    defineErrors('kernel', {
      UnknownError: (e: unknown) => e,
    });
    const { HandlerError: EventHandlerError } = EventsErrors.factories;

    this.events.onError((namespace, eventName, err) => {
      void this.errors.Throw(EventHandlerError(err), {
        source: 'event',
        namespace,
        eventName,
      });
    });
  }

  private configureEventAdapters(options?: KernelOptions): void {
    const adapters = options?.events?.adapters;
    const rxjs = options?.events?.rxjs;

    if (!adapters || adapters.includes('node')) {
      this.events.useAdapter(createNodeEventEmitterAdapter({ emitter: new EventEmitter() }));
    }

    if (adapters) {
      for (const a of adapters) {
        if (a === 'node') continue;
        this.events.useAdapter(a);
      }
    }

    if (rxjs) {
      this.events.useAdapter(createRxjsAdapter(rxjs));
    }
  }

  private registerDeclaratives(resolved: PluginInstance[]): void {
    const map: Record<string, Record<string, EventDef>> = {};
    for (const p of resolved) {
      const pluginHooks = (p as unknown as { hooks?: DeclaredHooksShape }).hooks;
      if (pluginHooks) {
        for (const hookName of Object.keys(pluginHooks)) {
          this.hooks.define(`${p.metadata.name}.${hookName}`);
        }
      }

      const pluginEvents = (p as unknown as { events?: DeclaredEventsShape }).events;
      if (pluginEvents) {
        const ns = this.events.namespace(pluginEvents.namespace);
        for (const [evt, def] of Object.entries(pluginEvents.spec)) {
          ns.define(
            evt,
            def.options as {
              delivery?: 'sync' | 'microtask' | 'async';
              startup?: 'drop' | 'buffer' | 'sticky';
              bufferSize?: number;
            }
          );
        }
        // accumulate for typed namespace map
        map[pluginEvents.namespace] = pluginEvents.spec as unknown as Record<string, EventDef>;
      }

      const pluginErrors = (
        p as unknown as { errors?: { namespace: string; kinds: readonly string[] } }
      ).errors;
      if (pluginErrors) {
        // no-op: factories available to plugins via errors module
      }

      const pluginAlerts = (
        p as unknown as { alerts?: { namespace: string; spec: Record<string, AlertDef> } }
      ).alerts;
      if (pluginAlerts) {
        bindAlerts(this.alerts as unknown as AlertBus, {
          namespace: pluginAlerts.namespace,
          spec: pluginAlerts.spec,
        });
      }
    }
    // cast events to a typed view if any specs were declared
    void map;
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
    kernel: Kernel<TPlugins, TAugments, TEventMap, TAlertMap>;
    hooks: HookBus;
    events: TypedEvents<TEventMap>;
    errors: ErrorBus;
    alerts: AlertBus & TypedAlertsAlerts<TAlertMap>;
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
      hooks: this.hooks,
      events: this.events,
      errors: this.errors,
      alerts: this.alerts,
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
      await this.errors.Throw(KernelCodeFactory(err), { source: 'lifecycle' });
      return;
    }
    const { UnknownError: LocalUnknownError } = defineErrors('kernel', {
      UnknownError: (e: unknown) => e,
    }).factories;
    await this.errors.Throw(LocalUnknownError(err), { source: 'lifecycle' });
  }
}
