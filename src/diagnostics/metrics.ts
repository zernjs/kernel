/**
 * @file Simple in-memory metrics (counters and histograms) for diagnostics.
 */
import type { Counter, Histogram, MetricsRegistry } from '@types';
import { parallelMap } from '@utils';

/**
 * In-memory monotonically increasing counter.
 */
class InMemoryCounter implements Counter {
  private current = 0;
  inc(delta: number = 1): void {
    this.current += delta;
  }
  reset(): void {
    this.current = 0;
  }
  value(): number {
    return this.current;
  }
}

/**
 * In-memory histogram storing observed values.
 */
class InMemoryHistogram implements Histogram {
  private samples: number[] = [];
  observe(ms: number): void {
    this.samples.push(ms);
  }
  values(): readonly number[] {
    return this.samples;
  }
  reset(): void {
    this.samples = [];
  }
}

/**
 * Create an in-memory metrics registry.
 * @returns Registry providing counters and histograms.
 */
export function createInMemoryMetrics(): MetricsRegistry {
  const counters = new Map<string, InMemoryCounter>();
  const histograms = new Map<string, InMemoryHistogram>();
  const registry: MetricsRegistry & {
    batchObserve?: (name: string, values: number[], concurrency?: number) => Promise<void>;
  } = {
    /**
     * Get or create a counter by name.
     * @param name - Metric name.
     * @returns Counter instance.
     */
    counter(name: string): Counter {
      let c = counters.get(name);
      if (!c) {
        c = new InMemoryCounter();
        counters.set(name, c);
      }
      return c;
    },
    /**
     * Get or create a histogram by name.
     * @param name - Metric name.
     * @returns Histogram instance.
     */
    histogram(name: string): Histogram {
      let h = histograms.get(name);
      if (!h) {
        h = new InMemoryHistogram();
        histograms.set(name, h);
      }
      return h;
    },
  };
  registry.batchObserve = async (
    name: string,
    values: number[],
    concurrency = 8
  ): Promise<void> => {
    let h = histograms.get(name);
    if (!h) {
      h = new InMemoryHistogram();
      histograms.set(name, h);
    }
    await parallelMap(values, concurrency, async v => h!.observe(v));
  };
  return registry;
}
