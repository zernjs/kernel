/**
 * onReady Lifecycle Hook
 * Called when all plugins are initialized and the kernel is ready
 */

import { MESSAGES } from '../config';

export function onReady(): void {
  console.log(MESSAGES.READY);

  // Any logic that needs to run after all plugins are ready...
}
