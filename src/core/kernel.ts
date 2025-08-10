import { EventEmitter } from 'node:events';
import { PluginRegistry } from '@core/registry';
import { createPluginAccessor } from '@core/accessor';
import type { KernelOptions, PluginInstance, PluginAccessor, ApplyAugmentsToPlugins } from '@types';
import { PLUGIN_SETUP_SYMBOL } from '@types';
import { resolvePluginOrder } from '@resolver';
import { LifecycleEngine, LifecycleEvents } from '@lifecycle';
import { HookBus } from '@hooks';
import { EventBus } from '@events';
import { createNodeEventEmitterAdapter } from '@events/adapters';
import { createRxjsAdapter } from '@events/adapters';
import { ErrorBus, bindErrors, isKernelError } from '@errors';
import { AlertBus, bindAlerts } from '@alerts';
import { createAugmenter, validateOptions } from '@plugin';
import { fromPromise } from '@utils';

export class Kernel<
  TPlugins extends Record<string, PluginInstance> = Record<never, never>,
  TAugments extends Record<string, object> = Record<never, never>,
> {
  public readonly plugins: PluginAccessor<ApplyAugmentsToPlugins<TPlugins, TAugments>>;
  private readonly registry: PluginRegistry;
  private _loadedPlugins: string[] = [];
  private readonly lifecycle = new LifecycleEngine();
  public readonly lifecycleEvents = new LifecycleEvents();
  public readonly hooks: HookBus;
  public readonly events = new EventBus();
  public readonly errors = new ErrorBus();
  public readonly alerts = new AlertBus();

  get loadedPlugins(): readonly string[] {
    return this._loadedPlugins;
  }

  constructor(registry?: PluginRegistry, options?: KernelOptions) {
    this.registry = registry ?? new PluginRegistry();
    this.plugins = createPluginAccessor<ApplyAugmentsToPlugins<TPlugins, TAugments>>(this.registry);
    // HookBus with error routing
    this.hooks = new HookBus(this.errors);

    // Configure default adapters: Node EventEmitter as default/fallback
    const adapters = options?.events?.adapters;
    const rxjs = options?.events?.rxjs;

    // Route event handler errors to ErrorBus (basic integration)
    this.events.onError((namespace, eventName, err) => {
      void this.errors.emit('events', 'HandlerError', err, {
        source: 'event',
        namespace,
        eventName,
      });
    });

    // Always add Node adapter unless explicitly disabled
    if (!adapters || adapters.includes('node')) {
      this.events.useAdapter(createNodeEventEmitterAdapter({ emitter: new EventEmitter() }));
    }

    // Include any custom adapters provided
    if (adapters) {
      for (const a of adapters) {
        if (a === 'node') continue; // already handled
        this.events.useAdapter(a);
      }
    }

    // Optionally include RxJS adapter if configured
    if (rxjs) {
      this.events.useAdapter(createRxjsAdapter(rxjs));
    }
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
    // Fase 3: executar fases básicas
    try {
      // Fase 4: registrar hooks declarados por plugin (namespaced)
      for (const p of resolved) {
        const pluginHooks = (
          p as unknown as {
            hooks?: Record<string, { on: unknown; off: unknown; emit: unknown; once: unknown }>;
          }
        ).hooks;
        if (pluginHooks) {
          for (const hookName of Object.keys(pluginHooks)) {
            this.hooks.define(`${p.metadata.name}.${hookName}`);
          }
        }
        const pluginEvents = (
          p as unknown as {
            events?: {
              namespace: string;
              spec: Record<
                string,
                {
                  __type: 'event-def';
                  options?: { delivery?: string; startup?: string; bufferSize?: number };
                }
              >;
            };
          }
        ).events;
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
        }

        // Errors/Alerts declarativos → disponibilizar helpers no contexto do plugin (opcional futuro)
        const pluginErrors = (
          p as unknown as { errors?: { namespace: string; kinds: readonly string[] } }
        ).errors;
        if (pluginErrors) {
          // bind helpers now so plugins could use via ctx in futuro
          bindErrors(
            this.errors,
            pluginErrors.namespace,
            Object.fromEntries(pluginErrors.kinds.map(k => [k, { __type: 'error-def' } as const]))
          );
        }
        const pluginAlerts = (
          p as unknown as { alerts?: { namespace: string; kinds: readonly string[] } }
        ).alerts;
        if (pluginAlerts) {
          bindAlerts(
            this.alerts,
            pluginAlerts.namespace,
            Object.fromEntries(pluginAlerts.kinds.map(k => [k, { __type: 'alert-def' } as const]))
          );
        }
      }
      // iniciar EventBus (liberar buffer/sticky)
      this.events.start();
      await this.lifecycle.runPhase('beforeInit', resolved, this);

      // Augmentations (ctx.extend e declarativas)
      const targets: Record<string, object> = {};
      const extend = createAugmenter(targets);

      for (const p of resolved) {
        const setup = (p as unknown as { [k: symbol]: unknown })[PLUGIN_SETUP_SYMBOL] as
          | ((ctx: unknown, options?: unknown) => unknown | Promise<unknown>)
          | undefined;
        if (setup) {
          // Build typed dependency subset for context (runtime map by declared dependsOn)
          const ctor = (
            p as unknown as {
              constructor: { dependsOn?: Array<new () => PluginInstance> };
            }
          ).constructor;
          const depCtors: Array<new () => PluginInstance> = ctor.dependsOn ?? [];
          const depPlugins: Record<string, unknown> = {};
          for (const dCtor of depCtors) {
            const depName = new dCtor().metadata.name;
            const inst = this.plugins.get(depName);
            if (inst) depPlugins[depName] = inst as unknown as object;
          }
          const ctx = {
            kernel: this,
            hooks: this.hooks,
            events: this.events,
            errors: this.errors,
            alerts: this.alerts,
            plugins: depPlugins,
            use: (name: string): unknown => depPlugins[name],
            extend: (target: string, api: Record<string, unknown>): void => extend(target, api),
          } as const;
          // Validate plugin options if provided on the instance spec
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
          // Make base API available immediately so dependents can use it during their setup
          const selfInstance = this.plugins.get(p.metadata.name);
          if (selfInstance) Object.assign(selfInstance as unknown as object, api as object);
          // Also store to apply declarative/programmatic augmentations after all setups
          targets[p.metadata.name] = api as object;
        }
        const aug = (
          p as unknown as { augments?: Partial<Record<string, Record<string, unknown>>> }
        ).augments;
        if (aug) {
          for (const [target, api] of Object.entries(aug)) extend(target, api!);
        }
      }

      // Aplicar merges nas instâncias registradas
      for (const [name, api] of Object.entries(targets)) {
        const inst = this.plugins.get(name);
        if (inst) Object.assign(inst as unknown as object, api);
      }

      await this.lifecycle.runPhase('init', resolved, this);
      await this.lifecycle.runPhase('afterInit', resolved, this);
      this._loadedPlugins = resolved.map(p => p.metadata.name);
      for (const p of resolved)
        await this.lifecycleEvents.emit('pluginLoaded', { name: p.metadata.name });
    } catch (err) {
      // Emit error to ErrorBus with best-effort metadata
      if (isKernelError(err)) {
        await this.errors.emit('kernel', err.code, err, { source: 'lifecycle' });
      } else {
        await this.errors.emit('kernel', 'UnknownError', err as unknown, { source: 'lifecycle' });
      }
      // on first failure, emite pluginFailed do plugin corrente (difícil identificar sem granularidade)
      await this.lifecycleEvents.emit('pluginFailed', { name: 'unknown', error: err });
      throw err;
    }
  }

  get<K extends keyof ApplyAugmentsToPlugins<TPlugins, TAugments> & string>(
    name: K
  ): ApplyAugmentsToPlugins<TPlugins, TAugments>[K] | null {
    return this.plugins.get(name);
  }

  async destroy(): Promise<void> {
    const all = this.plugins.list().slice().reverse();
    await this.lifecycle.runPhase('beforeDestroy', all, this);
    await this.lifecycle.runPhase('destroy', all, this);
    await this.lifecycle.runPhase('afterDestroy', all, this);
    this.plugins.clear();
    this._loadedPlugins = [];
  }
}
