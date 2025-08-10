import type { KernelErrorCode } from '@types';

export class KernelError<
  TDetails extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  public readonly code: KernelErrorCode;
  public readonly details: TDetails;

  constructor(code: KernelErrorCode, message: string, details: TDetails) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'KernelError';
  }
}

export function isKernelError(err: unknown): err is KernelError<Record<string, unknown>> {
  return (
    Boolean(err) && typeof err === 'object' && (err as { name?: string }).name === 'KernelError'
  );
}

export function dependencyMissing(
  plugin: string,
  dependency: string
): KernelError<{ plugin: string; dependency: string }> {
  return new KernelError(
    'DependencyMissing',
    `Plugin '${plugin}' requires dependency '${dependency}' which was not found`,
    {
      plugin,
      dependency,
    }
  );
}

export function dependencyVersionUnsatisfied(
  plugin: string,
  dependency: string,
  required: string,
  found: string
): KernelError<{ plugin: string; dependency: string; required: string; found: string }> {
  return new KernelError(
    'DependencyVersionUnsatisfied',
    `Plugin '${plugin}' requires '${dependency}' version ${required}, found ${found}`,
    { plugin, dependency, required, found }
  );
}

export function dependencyCycle(chain: string[]): KernelError<{ chain: string[] }> {
  return new KernelError('DependencyCycle', `Dependency cycle detected: ${chain.join(' -> ')}`, {
    chain,
  });
}

export function lifecyclePhaseFailed(
  plugin: string,
  phase: string,
  cause?: unknown
): KernelError<{ plugin: string; phase: string; cause?: unknown }> {
  return new KernelError(
    'LifecyclePhaseFailed',
    `Lifecycle phase '${phase}' failed for plugin '${plugin}'`,
    {
      plugin,
      phase,
      cause: cause as unknown,
    }
  );
}

export function invalidVersionSpec(
  plugin: string,
  dependency: string,
  value: string,
  which: 'range' | 'actual'
): KernelError<{ plugin: string; dependency: string; value: string; which: 'range' | 'actual' }> {
  return new KernelError(
    'InvalidVersionSpec',
    `Invalid ${which} semver '${value}' for dependency '${dependency}' in plugin '${plugin}'`,
    { plugin, dependency, value, which }
  );
}
