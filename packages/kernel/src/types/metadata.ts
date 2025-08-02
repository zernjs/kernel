/**
 * @fileoverview Plugin metadata and configuration types for the Zern Kernel
 * @module @zern/kernel/types/metadata
 */

import {
  NonEmptyArray,
  NonNullable,
  Prettify,
  DeepReadonly,
  Optional,
  RequireAtLeastOne,
  Result,
  PluginId,
  PluginVersion,
} from './utils';

/**
 * Plugin metadata information
 */
export type PluginMetadata = Prettify<{
  /** Plugin unique identifier */
  readonly id: PluginId;
  /** Plugin version (semver) */
  readonly version: PluginVersion;
  /** Plugin display name */
  readonly name?: NonNullable<string>;
  /** Plugin description */
  readonly description?: NonNullable<string>;
  /** Plugin author information */
  readonly author?: NonNullable<string> | PluginAuthor;
  /** Plugin license */
  readonly license?: NonNullable<string>;
  /** Plugin homepage URL */
  readonly homepage?: NonNullable<string>;
  /** Plugin repository information */
  readonly repository?: NonNullable<string> | PluginRepository;
  /** Plugin keywords for discovery */
  readonly keywords?: NonEmptyArray<string>;
  /** Plugin tags for categorization */
  readonly tags?: NonEmptyArray<string>;
  /** Plugin creation timestamp */
  readonly createdAt?: number;
  /** Plugin last update timestamp */
  readonly updatedAt?: number;
  /** Plugin build information */
  readonly build?: PluginBuildInfo;
  /** Plugin runtime requirements */
  readonly requirements?: PluginRequirements;
  /** Plugin feature flags */
  readonly features?: PluginFeatures;
  /** Plugin experimental flags */
  readonly experimental?: boolean;
  /** Plugin deprecation information */
  readonly deprecated?: boolean | PluginDeprecationInfo;
  /** Plugin security information */
  readonly security?: PluginSecurityInfo;
  /** Plugin performance hints */
  readonly performance?: PluginPerformanceHints;
  /** Custom metadata fields */
  readonly custom?: DeepReadonly<Record<string, unknown>>;
}>;

/**
 * Plugin author information
 */
export type PluginAuthor = Prettify<{
  /** Author name */
  readonly name: NonNullable<string>;
  /** Author email */
  readonly email?: NonNullable<string>;
  /** Author website */
  readonly url?: NonNullable<string>;
  /** Author social profiles */
  readonly social?: DeepReadonly<Record<string, string>>;
}>;

/**
 * Plugin repository information
 */
export type PluginRepository = Prettify<{
  /** Repository type (git, svn, etc.) */
  readonly type: NonNullable<string>;
  /** Repository URL */
  readonly url: NonNullable<string>;
  /** Repository directory (for monorepos) */
  readonly directory?: NonNullable<string>;
  /** Repository branch */
  readonly branch?: NonNullable<string>;
}>;

/**
 * Plugin build information
 */
export type PluginBuildInfo = Prettify<{
  /** Build timestamp */
  readonly timestamp: number;
  /** Build version/hash */
  readonly version: NonNullable<string>;
  /** Build environment */
  readonly environment: 'development' | 'staging' | 'production';
  /** Build tools used */
  readonly tools?: DeepReadonly<Record<string, string>>;
  /** Build target */
  readonly target?: NonNullable<string>;
  /** Build optimization level */
  readonly optimization?: 'none' | 'basic' | 'aggressive';
}>;

/**
 * Plugin runtime requirements
 */
export type PluginRequirements = Prettify<{
  /** Minimum kernel version */
  readonly kernelVersion?: PluginVersion;
  /** Node.js version requirements */
  readonly nodeVersion?: PluginVersion;
  /** Platform requirements */
  readonly platforms?: NonEmptyArray<'win32' | 'darwin' | 'linux' | 'freebsd'>;
  /** CPU architecture requirements */
  readonly arch?: NonEmptyArray<'x64' | 'arm64' | 'ia32' | 'arm'>;
  /** Memory requirements (in MB) */
  readonly memory?: {
    readonly min?: number;
    readonly recommended?: number;
    readonly max?: number;
  };
  /** Disk space requirements (in MB) */
  readonly diskSpace?: number;
  /** Network requirements */
  readonly network?: {
    readonly required?: boolean;
    readonly protocols?: NonEmptyArray<string>;
    readonly ports?: NonEmptyArray<number>;
  };
  /** Environment variables required */
  readonly env?: NonEmptyArray<string>;
  /** External dependencies */
  readonly external?: NonEmptyArray<PluginExternalDependency>;
}>;

/**
 * External dependency specification
 */
export type PluginExternalDependency = Prettify<{
  /** Dependency name */
  readonly name: NonNullable<string>;
  /** Dependency type */
  readonly type: 'binary' | 'service' | 'library' | 'runtime';
  /** Version constraint */
  readonly version?: PluginVersion;
  /** Whether dependency is optional */
  readonly optional?: boolean;
  /** Installation instructions */
  readonly install?: NonNullable<string>;
  /** Verification command */
  readonly verify?: NonNullable<string>;
}>;

/**
 * Plugin feature flags
 */
export type PluginFeatures = Prettify<{
  /** Hot reload support */
  readonly hotReload?: boolean;
  /** Configuration hot reload */
  readonly configHotReload?: boolean;
  /** Multi-instance support */
  readonly multiInstance?: boolean;
  /** Clustering support */
  readonly clustering?: boolean;
  /** Worker thread support */
  readonly workerThreads?: boolean;
  /** Async initialization */
  readonly asyncInit?: boolean;
  /** Lazy loading */
  readonly lazyLoad?: boolean;
  /** Tree shaking support */
  readonly treeShaking?: boolean;
  /** Source maps */
  readonly sourceMaps?: boolean;
  /** Debug mode */
  readonly debug?: boolean;
}>;

/**
 * Plugin deprecation information
 */
export type PluginDeprecationInfo = Prettify<{
  /** Deprecation reason */
  readonly reason: NonNullable<string>;
  /** Deprecation date */
  readonly since: NonNullable<string>;
  /** Removal date */
  readonly removeIn?: NonNullable<string>;
  /** Alternative plugin */
  readonly alternative?: PluginId;
  /** Migration guide URL */
  readonly migrationGuide?: NonNullable<string>;
}>;

/**
 * Plugin security information
 */
export type PluginSecurityInfo = Prettify<{
  /** Security policy URL */
  readonly policy?: NonNullable<string>;
  /** Known vulnerabilities */
  readonly vulnerabilities?: NonEmptyArray<PluginVulnerability>;
  /** Security contact */
  readonly contact?: NonNullable<string>;
  /** Security advisories */
  readonly advisories?: NonEmptyArray<string>;
  /** Permissions required */
  readonly permissions?: NonEmptyArray<PluginPermission>;
  /** Sandbox compatibility */
  readonly sandbox?: boolean;
  /** Content Security Policy */
  readonly csp?: NonNullable<string>;
}>;

/**
 * Plugin vulnerability information
 */
export type PluginVulnerability = Prettify<{
  /** Vulnerability ID */
  readonly id: NonNullable<string>;
  /** Severity level */
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description */
  readonly description: NonNullable<string>;
  /** Affected versions */
  readonly affectedVersions: NonNullable<string>;
  /** Fixed in version */
  readonly fixedIn?: PluginVersion;
  /** CVE identifier */
  readonly cve?: NonNullable<string>;
  /** Advisory URL */
  readonly advisory?: NonNullable<string>;
}>;

/**
 * Plugin permission specification
 */
export type PluginPermission = Prettify<{
  /** Permission name */
  readonly name: NonNullable<string>;
  /** Permission description */
  readonly description: NonNullable<string>;
  /** Permission level */
  readonly level: 'read' | 'write' | 'execute' | 'admin';
  /** Resource type */
  readonly resource: NonNullable<string>;
  /** Whether permission is required */
  readonly required: boolean;
}>;

/**
 * Plugin performance hints
 */
export type PluginPerformanceHints = Prettify<{
  /** Expected memory usage (in MB) */
  readonly memoryUsage?: {
    readonly idle?: number;
    readonly active?: number;
    readonly peak?: number;
  };
  /** Expected CPU usage (percentage) */
  readonly cpuUsage?: {
    readonly idle?: number;
    readonly active?: number;
    readonly peak?: number;
  };
  /** Startup time (in ms) */
  readonly startupTime?: number;
  /** Shutdown time (in ms) */
  readonly shutdownTime?: number;
  /** Bundle size (in KB) */
  readonly bundleSize?: number;
  /** Performance tier */
  readonly tier?: 'lightweight' | 'standard' | 'heavy';
  /** Optimization recommendations */
  readonly optimizations?: DeepReadonly<string[]>;
}>;

/**
 * Plugin configuration base interface
 */
export type PluginConfig = Prettify<{
  /** Whether plugin is enabled */
  readonly enabled?: boolean;
  /** Plugin-specific configuration */
  readonly [key: string]: unknown;
}>;

/**
 * Plugin configuration with metadata
 */
export type PluginConfigWithMetadata = Prettify<
  PluginConfig & {
    /** Configuration metadata */
    readonly $metadata?: {
      /** Configuration version */
      readonly version?: NonNullable<string>;
      /** Configuration source */
      readonly source?: NonNullable<string>;
      /** Configuration timestamp */
      readonly timestamp?: number;
      /** Configuration validation */
      readonly validated?: boolean;
      /** Configuration schema version */
      readonly schemaVersion?: NonNullable<string>;
    };
  }
>;

/**
 * Type guard to check if object is PluginMetadata
 */
export function isPluginMetadata(obj: unknown): obj is PluginMetadata {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'version' in obj &&
    typeof (obj as PluginMetadata).id === 'string' &&
    typeof (obj as PluginMetadata).version === 'string'
  );
}

/**
 * Type guard to check if object is PluginConfig
 */
export function isPluginConfig(obj: unknown): obj is PluginConfig {
  return typeof obj === 'object' && obj !== null;
}

/**
 * Create default plugin metadata
 */
export function createDefaultPluginMetadata(
  id: PluginId | string,
  version: PluginVersion | string
): PluginMetadata {
  const pluginId = typeof id === 'string' ? (id as PluginId) : id;
  const pluginVersion = typeof version === 'string' ? (version as PluginVersion) : version;

  return {
    id: pluginId,
    version: pluginVersion,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    experimental: false,
    deprecated: false,
    features: {
      hotReload: false,
      configHotReload: false,
      multiInstance: false,
      clustering: false,
      workerThreads: false,
      asyncInit: true,
      lazyLoad: false,
      treeShaking: true,
      sourceMaps: false,
      debug: false,
    },
    requirements: {
      platforms: ['win32', 'darwin', 'linux'] as NonEmptyArray<
        'win32' | 'darwin' | 'linux' | 'freebsd'
      >,
      arch: ['x64', 'arm64'] as NonEmptyArray<'x64' | 'arm64' | 'ia32' | 'arm'>,
    },
    security: {
      sandbox: true,
    },
    performance: {
      tier: 'standard',
    },
  } as const;
}

/**
 * Create plugin development configuration
 */
export function createPluginDevelopmentConfig(
  metadata: Optional<PluginMetadata, 'experimental'>
): Optional<PluginMetadata, 'experimental'> {
  return {
    ...metadata,
    experimental: true,
    features: {
      ...metadata.features,
      debug: true,
      sourceMaps: true,
      hotReload: true,
    },
  };
}

/**
 * Validate plugin metadata
 */
export function validatePluginMetadata(metadata: unknown): Result<PluginMetadata, Error> {
  if (!isPluginMetadata(metadata)) {
    return {
      success: false,
      error: new Error('Invalid plugin metadata structure'),
    };
  }

  // Additional validation logic can be added here
  return {
    success: true,
    data: metadata,
  };
}

/**
 * Create plugin search criteria with at least one criterion
 */
export function createPluginSearchCriteria(
  criteria: RequireAtLeastOne<{
    id?: PluginId;
    name?: NonNullable<string>;
    version?: PluginVersion;
    tags?: NonEmptyArray<string>;
    author?: NonNullable<string>;
  }>
): RequireAtLeastOne<{
  id?: PluginId;
  name?: NonNullable<string>;
  version?: PluginVersion;
  tags?: NonEmptyArray<string>;
  author?: NonNullable<string>;
}> {
  return criteria;
}
