import type { PhasePolicy } from '@types';
import { timeout } from '@utils';

async function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
  if (!ms || ms <= 0) return promise;
  return await timeout(promise, ms);
}

export async function runWithPolicy<T>(action: () => Promise<T>, policy?: PhasePolicy): Promise<T> {
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
