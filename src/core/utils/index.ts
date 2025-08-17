/**
 * @file Utilities module exports.
 * Provides a unified interface for all utility functionality.
 */

export {
  parseVersion,
  parseConstraint,
  compareVersions,
  satisfiesConstraint,
  stringifyVersion,
  getHighestVersion,
  type SemVer,
  type VersionConstraint,
} from './version.js';
