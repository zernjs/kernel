/**
 * onShutdown Lifecycle Hook
 * Called when the kernel is shutting down
 */

import { MESSAGES } from '../config';

export function onShutdown(): void {
  console.log(MESSAGES.SHUTDOWN);

  // Cleanup logic: close connections, save state, etc...
}
