import { describe, it, expect } from 'vitest';
import { createKernel } from '@core/createKernel';

describe('AlertBus basic', () => {
  it('emits and receives alerts', async () => {
    const kernel = createKernel().build();
    await kernel.init();

    let received: unknown = null;
    const off = kernel.alerts.on('ui', 'Info', p => {
      received = p;
    });

    await kernel.alerts.emit('ui', 'Info', { message: 'hello' });

    expect(received).toEqual({ message: 'hello' });
    off();
  });
});
