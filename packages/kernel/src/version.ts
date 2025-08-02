/**
 * @fileoverview Centralized version management for Zern Kernel
 * @module @zern/kernel/version
 */

/**
 * Main kernel version
 * This should be the single source of truth for the kernel version
 */
export const KERNEL_VERSION = '1.0.0';

/**
 * API version for compatibility tracking
 */
export const API_VERSION = '1.0.0';

/**
 * Types version for type system compatibility
 */
export const TYPES_VERSION = '1.0.0';

/**
 * Plugin system version constraints
 */
export const PLUGIN_VERSIONS = {
  /** Minimum plugin version supported */
  MIN: '1.0.0',
  /** Maximum plugin version supported */
  MAX: '2.0.0',
  /** Current plugin API version */
  API: '1.0.0',
} as const;

/**
 * Configuration schema versions
 */
export const CONFIG_VERSIONS = {
  /** Kernel configuration schema version */
  KERNEL: '1.0.0',
  /** Plugin configuration schema version */
  PLUGIN: '1.0.0',
  /** State schema version */
  STATE: '1.0.0',
  /** Event schema version */
  EVENT: '1.0.0',
} as const;

/**
 * Build and metadata versions
 */
export const BUILD_VERSIONS = {
  /** Build system version */
  BUILD: '1.0.0',
  /** Metadata schema version */
  METADATA: '1.0.0',
} as const;

/**
 * All versions in a single object for easy access
 */
export const VERSIONS = {
  KERNEL: KERNEL_VERSION,
  API: API_VERSION,
  TYPES: TYPES_VERSION,
  PLUGIN: PLUGIN_VERSIONS,
  CONFIG: CONFIG_VERSIONS,
  BUILD: BUILD_VERSIONS,
} as const;

/**
 * Version utilities
 */
export const VersionUtils = {
  /**
   * Get the main kernel version
   */
  getKernelVersion(): string {
    return KERNEL_VERSION;
  },

  /**
   * Get the API version
   */
  getApiVersion(): string {
    return API_VERSION;
  },

  /**
   * Get plugin version constraints
   */
  getPluginVersions() {
    return PLUGIN_VERSIONS;
  },

  /**
   * Get all versions
   */
  getAllVersions() {
    return VERSIONS;
  },

  /**
   * Check if a plugin version is supported
   */
  isPluginVersionSupported(version: string): boolean {
    // Simple semver check - in a real implementation you'd use a proper semver library
    return version >= PLUGIN_VERSIONS.MIN && version <= PLUGIN_VERSIONS.MAX;
  },
} as const;
