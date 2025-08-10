import { runWithPolicy } from '@lifecycle';
import { parallelMap } from '@utils';
import { lifecyclePhaseFailed } from '@errors';
import type { PhaseFn, LifecycleEngineOptions, LifecyclePhase, PluginInstance } from '@types';

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

  async runPhase(
    phase: LifecyclePhase,
    pluginsInOrder: PluginInstance[],
    kernel: unknown
  ): Promise<void> {
    const policy = this.opts.policies?.[phase];
    const fnName = phase as keyof PluginInstance;
    await parallelMap(pluginsInOrder, this.opts.concurrency ?? 1, async p => {
      const rec = p as unknown as Record<string, unknown> & { [k: string]: unknown };
      const fn = rec[fnName as string];
      if (typeof fn !== 'function') return;
      try {
        await runWithPolicy(async () => {
          await (fn as PhaseFn).call(p, p, kernel);
        }, policy);
      } catch (err) {
        throw lifecyclePhaseFailed(p.metadata.name, phase, err);
      }
    });
  }
}
