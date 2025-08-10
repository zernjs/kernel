import type { IAlertChannel } from '@types';
import { retry, timeout } from '@utils';

export class ConsoleChannel implements IAlertChannel {
  constructor(private readonly prefix: string = '[ALERT]') {}
  dispatch(namespace: string, kind: string, payload: unknown): void {
    console.warn(this.prefix, { namespace, kind, payload });
  }
}

export class WebhookChannel implements IAlertChannel {
  constructor(
    private readonly fetchFn: (url: string, init: unknown) => Promise<unknown>,
    private readonly url: string,
    private readonly opts?: {
      timeoutMs?: number;
      retry?: { retries: number; baseMs?: number; jitter?: number };
    }
  ) {}
  async dispatch(namespace: string, kind: string, payload: unknown): Promise<void> {
    const exec = async (): Promise<void> => {
      const doFetch = async (): Promise<void> => {
        await this.fetchFn(this.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ namespace, kind, payload }),
        });
      };
      if (this.opts?.timeoutMs) {
        await timeout(doFetch(), this.opts.timeoutMs);
      } else {
        await doFetch();
      }
    };
    if (this.opts?.retry) {
      await retry(exec, this.opts.retry);
    } else {
      await exec();
    }
  }
}
