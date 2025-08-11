/**
 * @file Policy runner with timeout and retry handling for lifecycle phases.
 */
import type { PhasePolicy } from '@types';
import { timeout } from '@utils';

type PolicyAction<T> = () => Promise<T>;

async function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
  if (!ms || ms <= 0) return promise;
  return await timeout(promise, ms);
}

/**
 * Runs an action under the provided policy (timeout and retries).
 * @param action Asynchronous action to run.
 * @param policy Phase policy.
 * @returns Action result or throws the last error after retries.
 */
export async function runWithPolicy<T>(action: PolicyAction<T>, policy?: PhasePolicy): Promise<T> {
  const retries = Math.max(0, policy?.retry ?? 0);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(action(), policy?.timeoutMs);
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
    }
  }
  throw lastErr;
}
