/**
 * @file Concurrency primitives: Semaphore, TaskQueue, and parallelMap.
 */

type Release = () => void;
type Waiter = () => void;
type Task = () => Promise<void>;
type WorkerFn<T, U> = (item: T, index: number) => Promise<U>;

export class Semaphore {
  private counter: number;
  private readonly queue: Waiter[] = [];

  constructor(private readonly maxConcurrency: number) {
    this.counter = maxConcurrency;
  }

  async acquire(): Promise<Release> {
    if (this.counter > 0) {
      this.counter -= 1;
      return () => this.release();
    }
    return await new Promise<Release>(resolve => {
      this.pushWaiter(resolve);
    });
  }

  private release(): void {
    this.counter += 1;
    const next = this.shiftWaiter();
    if (next) next();
  }

  private pushWaiter(resolve: (release: Release) => void): void {
    this.queue.push(() => {
      this.counter -= 1;
      resolve(() => this.release());
    });
  }

  private shiftWaiter(): Waiter | undefined {
    return this.queue.shift();
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
  private readonly queue: Task[] = [];
  private running = false;

  push(task: Task): void {
    this.queue.push(task);
    void this.run();
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length) {
      const t = this.nextTask();
      if (!t) break;
      try {
        await t();
      } catch {
        // swallow; observability should be added by caller
      }
    }
    this.running = false;
  }

  private nextTask(): Task | undefined {
    return this.queue.shift();
  }
}

export async function parallelMap<T, U>(
  items: readonly T[],
  limit: number,
  worker: WorkerFn<T, U>
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
