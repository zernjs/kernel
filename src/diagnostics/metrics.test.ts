/**
 * @file Unit tests for in-memory metrics.
 * @module diagnostics/metrics.test
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createInMemoryMetrics } from '@diagnostics/metrics';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createInMemoryMetrics', () => {
  it('creates and reuses counters by name', () => {
    const m = createInMemoryMetrics();
    const c1 = m.counter('hits');
    const c2 = m.counter('hits');
    expect(c1).toBe(c2);

    expect(c1.value()).toBe(0);
    c1.inc();
    expect(c1.value()).toBe(1);
    c1.inc(4);
    expect(c1.value()).toBe(5);

    c1.reset();
    expect(c1.value()).toBe(0);
  });

  it('creates and reuses histograms by name', () => {
    const m = createInMemoryMetrics();
    const h1 = m.histogram('latency');
    const h2 = m.histogram('latency');
    expect(h1).toBe(h2);

    expect(h1.values()).toEqual([]);
    h1.observe(12);
    h1.observe(3);
    expect(h1.values()).toEqual([12, 3]);

    h1.reset();
    expect(h1.values()).toEqual([]);
  });

  it('batchObserve adds values with default concurrency', async () => {
    const m = createInMemoryMetrics();
    const values = [1, 2, 3, 4, 5, 6];

    // @ts-expect-no-error optional method present in this implementation
    await (m as any).batchObserve('latency', values);

    expect(m.histogram('latency').values()).toEqual(values);
  });

  it('batchObserve uses provided concurrency limit', async () => {
    const m = createInMemoryMetrics();
    const values = Array.from({ length: 10 }, (_, i) => i + 1);

    // Spy on internal histogram to detect calls
    const hist = m.histogram('latency');
    const observeSpy = vi.spyOn(hist, 'observe');

    // @ts-expect-no-error optional method present in this implementation
    await (m as any).batchObserve('latency', values, 3);

    // All values observed
    expect(hist.values()).toEqual(values);

    // Observe called once per value
    expect(observeSpy).toHaveBeenCalledTimes(values.length);
  });
});
