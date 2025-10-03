/**
 * onInit Lifecycle Hook
 * Called when the plugin is registered with the kernel
 */

import type { PluginSetupContext } from '../../../../src';
import { MESSAGES } from '../config';

export function onInit({ plugins }: PluginSetupContext): void {
  console.log(MESSAGES.INIT);

  // Check for optional logger plugin
  if (plugins.logger) {
    console.log(MESSAGES.LOGGER_DETECTED);
    // Could use logger here if available
    // plugins.logger.info('Math plugin initializing');
  } else {
    console.log(MESSAGES.LOGGER_NOT_FOUND);
  }

  // Any other initialization logic...
}
