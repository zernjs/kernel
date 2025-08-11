/**
 * @file Kernel-specific error types and helpers.
 */
import type { KernelErrorCode } from '@types';

/**
 * KernelError represents structured failures originating from kernel subsystems.
 * @typeParam TDetails - Shape of the structured details attached to the error.
 */
export class KernelError<
  TDetails extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  public readonly code: KernelErrorCode;
  public readonly details: TDetails;

  /**
   * Construct a KernelError with a code, message and structured details.
   * @param code - Stable kernel error code.
   * @param message - Human-readable message.
   * @param details - Structured details object.
   */
  constructor(code: KernelErrorCode, message: string, details: TDetails) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'KernelError';
  }
}

/**
 * Type guard for KernelError instances.
 * @param err - Unknown error value.
 * @returns True if the value is a KernelError.
 */
export function isKernelError(err: unknown): err is KernelError<Record<string, unknown>> {
  return (
    Boolean(err) && typeof err === 'object' && (err as { name?: string }).name === 'KernelError'
  );
}

/**
 * Build a DependencyMissing KernelError.
 * @param plugin - Plugin that declared the dependency.
 * @param dependency - Missing dependency name.
 */
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

/**
 * Build a DependencyVersionUnsatisfied KernelError.
 * @param plugin - Plugin that declared the dependency.
 * @param dependency - Dependency name.
 * @param required - Required semver range.
 * @param found - Found version.
 */
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

/**
 * Build a DependencyCycle KernelError.
 * @param chain - Detected dependency cycle chain.
 */
export function dependencyCycle(chain: string[]): KernelError<{ chain: string[] }> {
  return new KernelError('DependencyCycle', `Dependency cycle detected: ${chain.join(' -> ')}`, {
    chain,
  });
}

/**
 * Build a LifecyclePhaseFailed KernelError.
 * @param plugin - Plugin where the failure occurred.
 * @param phase - Lifecycle phase name.
 * @param cause - Optional original error.
 */
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

/**
 * Build an InvalidVersionSpec KernelError.
 * @param plugin - Plugin that declared the dependency.
 * @param dependency - Dependency name.
 * @param value - Invalid value.
 * @param which - Which part is invalid (range or actual).
 */
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
