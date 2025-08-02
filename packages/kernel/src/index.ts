/**
 * @fileoverview Main entry point for the Zern Kernel
 * @module @zern/kernel
 */

// Export main kernel class
export { ZernKernel } from './kernel.js';

// Export all types
export * from './types/index.js';

// Export version information
export * from './version.js';

// Legacy export for backward compatibility
export { KERNEL_VERSION as VERSION } from './version.js';
