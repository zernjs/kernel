export class Semaphore {
  private counter: number;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrency: number) {
    this.counter = maxConcurrency;
  }

  async acquire(): Promise<() => void> {
    if (this.counter > 0) {
      this.counter -= 1;
      return () => this.release();
    }
    return new Promise(resolve => {
      this.queue.push(() => {
        this.counter -= 1;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.counter += 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

export async function withSemaphore<T>(sem: Semaphore, fn: () => Promise<T>): Promise<T> {
  const release = await sem.acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

export class TaskQueue {
  private readonly queue: Array<() => Promise<void>> = [];
  private running = false;

  push(task: () => Promise<void>): void {
    this.queue.push(task);
    void this.run();
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const t = this.queue.shift();
      if (!t) break;
      try {
        await t();
      } catch {
        // swallow; observability should be added by caller
      }
    }
    this.running = false;
  }
}

export async function parallelMap<T, U>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const sem = new Semaphore(Math.max(1, limit));
  const results: U[] = new Array(items.length);
  await Promise.all(
    items.map(async (item, index) =>
      withSemaphore(sem, async () => {
        results[index] = await worker(item, index);
      })
    )
  );
  return results;
}
