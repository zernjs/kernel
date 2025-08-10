import type { Counter, Histogram, MetricsRegistry } from '@types';
import { parallelMap } from '@utils';

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

export function createInMemoryMetrics(): MetricsRegistry {
  const counters = new Map<string, InMemoryCounter>();
  const histograms = new Map<string, InMemoryHistogram>();
  const registry: MetricsRegistry & {
    batchObserve?: (name: string, values: number[], concurrency?: number) => Promise<void>;
  } = {
    counter(name: string): Counter {
      let c = counters.get(name);
      if (!c) {
        c = new InMemoryCounter();
        counters.set(name, c);
      }
      return c;
    },
    histogram(name: string): Histogram {
      let h = histograms.get(name);
      if (!h) {
        h = new InMemoryHistogram();
        histograms.set(name, h);
      }
      return h;
    },
  };
  // utilitário extra (fora da interface pública) para uso interno
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
    await parallelMap(values, concurrency, async v => {
      h!.observe(v);
    });
  };
  return registry;
}
