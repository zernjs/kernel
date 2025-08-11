/**
 * @file Lifecycle engine to run plugin phases with policies and concurrency.
 */
import { runWithPolicy } from '@lifecycle';
import { parallelMap } from '@utils';
import { lifecyclePhaseFailed } from '@errors';
import type {
  PhaseFn,
  LifecycleEngineOptions,
  LifecyclePhase,
  PluginInstance,
  PluginPhaseMethodName,
  PhasePolicy,
} from '@types';

// phases order reference (future use for more complex scheduling)
const PHASES: ReadonlyArray<LifecyclePhase> = Object.freeze([
  'beforeInit',
  'init',
  'afterInit',
  'beforeDestroy',
  'destroy',
  'afterDestroy',
]);
void PHASES;

export class LifecycleEngine {
  constructor(private readonly opts: LifecycleEngineOptions = {}) {}

  /**
   * Runs a lifecycle phase across plugins following the configured policy and concurrency.
   * @param phase Phase name.
   * @param pluginsInOrder Plugins in resolved order.
   * @param kernel Kernel instance to pass to phase functions.
   */
  async runPhase(
    phase: LifecyclePhase,
    pluginsInOrder: PluginInstance[],
    kernel: unknown
  ): Promise<void> {
    const policy = this.opts.policies?.[phase];
    await parallelMap(pluginsInOrder, this.opts.concurrency ?? 1, async plugin => {
      const fn = this.resolvePhaseFn(plugin, phase);
      if (!fn) return;
      try {
        await this.executeWithPolicy(fn, plugin, kernel, policy);
      } catch (err) {
        this.raisePhaseFailed(plugin, phase, err);
      }
    });
  }

  private resolvePhaseFn(plugin: PluginInstance, phase: LifecyclePhase): PhaseFn | undefined {
    const rec = plugin as unknown as Record<string, unknown> & { [k: string]: unknown };
    const fnName = phase as PluginPhaseMethodName;
    const fn = rec[fnName as string];
    return typeof fn === 'function' ? (fn as PhaseFn) : undefined;
  }

  private async executeWithPolicy(
    fn: PhaseFn,
    plugin: PluginInstance,
    kernel: unknown,
    policy?: PhasePolicy
  ): Promise<void> {
    await runWithPolicy(async () => {
      await fn.call(plugin, plugin, kernel);
    }, policy);
  }

  private raisePhaseFailed(plugin: PluginInstance, phase: LifecyclePhase, err: unknown): never {
    throw lifecyclePhaseFailed(plugin.metadata.name, phase, err);
  }
}
