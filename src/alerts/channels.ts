/**
 * @file Built-in alert channels. Channels receive every alert emitted from the bus.
 */
import type { IAlertChannel } from '@types';
import { retry, timeout } from '@utils';

/**
 * Console channel that logs alert payloads.
 * @param prefix - Log prefix used before entries.
 */
export class ConsoleChannel implements IAlertChannel {
  constructor(private readonly prefix: string = '[ALERT]') {}
  dispatch(namespace: string, kind: string, payload: unknown): void {
    console.warn(this.prefix, { namespace, kind, payload });
  }
}

type WebhookRetryOptions = { retries: number; baseMs?: number; jitter?: number };

type WebhookOptions = {
  timeoutMs?: number;
  retry?: WebhookRetryOptions;
};

/**
 * Webhook channel that POSTs alerts to a remote endpoint with optional timeout and retry.
 * @param fetchFn - Function used to perform HTTP requests.
 * @param url - Target webhook URL.
 * @param opts - Optional timeout and retry configuration.
 */
export class WebhookChannel implements IAlertChannel {
  constructor(
    private readonly fetchFn: (url: string, init: unknown) => Promise<unknown>,
    private readonly url: string,
    private readonly opts?: WebhookOptions
  ) {}
  async dispatch(namespace: string, kind: string, payload: unknown): Promise<void> {
    const exec = async (): Promise<void> => {
      const doFetch = async (): Promise<void> => {
        await this.fetchFn(this.url, this.buildRequest(namespace, kind, payload));
      };
      if (this.opts?.timeoutMs) await timeout(doFetch(), this.opts.timeoutMs);
      else await doFetch();
    };
    if (this.opts?.retry) await retry(exec, this.opts.retry);
    else await exec();
  }

  /**
   * Build the webhook request init object.
   * @param namespace - Alerts namespace.
   * @param kind - Alert kind.
   * @param payload - Alert payload.
   * @returns Request init for a JSON POST.
   */
  private buildRequest(
    namespace: string,
    kind: string,
    payload: unknown
  ): {
    method: 'POST';
    headers: { 'content-type': 'application/json' };
    body: string;
  } {
    return {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ namespace, kind, payload }),
    };
  }
}
