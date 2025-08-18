/**
 * @file Dependency Entity - Core business logic for plugin dependencies.
 * Encapsulates dependency behavior and validation rules.
 */

import type { PluginId, PluginName, Version } from '../../shared/types/common.types.js';
import type { Result } from '../../shared/types/result.types.js';
import type { VersionConstraint } from './dependency.types.js';
import { DependencyError, ConflictType } from './dependency.types.js';

/**
 * Semantic version interface
 */
export interface SemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
  readonly build?: string;
}

/**
 * Converts a Version string to SemVer interface.
 */
function parseVersion(version: Version): SemVer {
  const versionStr = version as string;
  const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-([^+]+))?(?:\+(.+))?$/);

  if (!match) {
    throw new Error(`Invalid version format: ${versionStr}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

/**
 * Dependency condition for conditional dependencies.
 */
export interface DependencyCondition {
  readonly type: 'environment' | 'feature' | 'config' | 'runtime';
  readonly key: string;
  readonly value: unknown;
  readonly operator: '=' | '!=' | 'exists' | 'not_exists';
}

/**
 * Plugin dependency entity representing a dependency relationship.
 */
export class DependencyEntity {
  private readonly _pluginId: PluginId;
  private readonly _pluginName: PluginName;
  private readonly _versionConstraint: VersionConstraint;
  private readonly _isOptional: boolean;
  private readonly _loadOrder: number;
  private readonly _conditions: readonly DependencyCondition[];
  private _isResolved: boolean = false;
  private _resolvedVersion?: SemVer;
  private _lastValidationTime?: Date;
  private _validationErrors: readonly DependencyError[] = [];

  constructor(
    pluginId: PluginId,
    pluginName: PluginName,
    versionConstraint: VersionConstraint,
    isOptional: boolean = false,
    loadOrder: number = 0,
    conditions: readonly DependencyCondition[] = []
  ) {
    this._pluginId = pluginId;
    this._pluginName = pluginName;
    this._versionConstraint = versionConstraint;
    this._isOptional = isOptional;
    this._loadOrder = loadOrder;
    this._conditions = [...conditions];
    this.validateDependency();
  }

  /**
   * Gets the plugin ID.
   */
  get pluginId(): PluginId {
    return this._pluginId;
  }

  /**
   * Gets the plugin name.
   */
  get pluginName(): PluginName {
    return this._pluginName;
  }

  /**
   * Gets the version constraint.
   */
  get versionConstraint(): VersionConstraint {
    return { ...this._versionConstraint };
  }

  /**
   * Checks if dependency is optional.
   */
  get isOptional(): boolean {
    return this._isOptional;
  }

  /**
   * Gets the load order priority.
   */
  get loadOrder(): number {
    return this._loadOrder;
  }

  /**
   * Gets dependency conditions.
   */
  get conditions(): readonly DependencyCondition[] {
    return [...this._conditions];
  }

  /**
   * Checks if dependency is resolved.
   */
  get isResolved(): boolean {
    return this._isResolved;
  }

  /**
   * Gets resolved version if available.
   */
  get resolvedVersion(): SemVer | undefined {
    return this._resolvedVersion ? { ...this._resolvedVersion } : undefined;
  }

  /**
   * Gets last validation time.
   */
  get lastValidationTime(): Date | undefined {
    return this._lastValidationTime;
  }

  /**
   * Gets validation errors.
   */
  get validationErrors(): readonly DependencyError[] {
    return [...this._validationErrors];
  }

  /**
   * Validates if a version satisfies this dependency's constraint.
   */
  satisfiesVersion(version: SemVer): boolean {
    return this.evaluateVersionConstraint(this._versionConstraint, version);
  }

  /**
   * Validates dependency conditions against context.
   */
  satisfiesConditions(context: Record<string, unknown>): boolean {
    return this._conditions.every(condition => this.evaluateCondition(condition, context));
  }

  /**
   * Resolves the dependency with a specific version.
   */
  resolve(version: SemVer, context?: Record<string, unknown>): Result<void, DependencyError> {
    // Validate version constraint
    if (!this.satisfiesVersion(version)) {
      const constraintVersion = parseVersion(this._versionConstraint.version);
      const error = new DependencyError(
        ConflictType.VERSION_MISMATCH,
        {
          required: `${this._versionConstraint.operator}${constraintVersion.major}.${constraintVersion.minor}.${constraintVersion.patch}`,
          found: `${version.major}.${version.minor}.${version.patch}`,
        },
        `Version mismatch for ${this._pluginId}`
      );
      return { success: false, error };
    }

    // Validate conditions if context provided
    if (context && !this.satisfiesConditions(context)) {
      const error = new DependencyError(
        ConflictType.CONDITION_CONFLICT,
        undefined,
        `Dependency conditions not met for ${this._pluginId}`
      );
      return { success: false, error };
    }

    this._isResolved = true;
    this._resolvedVersion = { ...version };
    this._lastValidationTime = new Date();
    this._validationErrors = [];

    return { success: true, data: undefined };
  }

  /**
   * Unresolves the dependency.
   */
  unresolve(): void {
    this._isResolved = false;
    this._resolvedVersion = undefined;
  }

  /**
   * Validates the dependency definition.
   */
  validate(): Result<void, DependencyError> {
    const errors: DependencyError[] = [];

    // Validate plugin ID
    if (!this._pluginId || this._pluginId.trim().length === 0) {
      errors.push(
        new DependencyError(ConflictType.MISSING_DEPENDENCY, undefined, 'Plugin ID cannot be empty')
      );
    }

    // Validate plugin name
    if (!this._pluginName || this._pluginName.trim().length === 0) {
      errors.push(
        new DependencyError(
          ConflictType.MISSING_DEPENDENCY,
          undefined,
          'Plugin name cannot be empty'
        )
      );
    }

    // Validate version constraint
    const versionValidation = this.validateVersionConstraint(this._versionConstraint);
    if (!versionValidation.success) {
      errors.push(versionValidation.error);
    }

    // Validate conditions
    for (const condition of this._conditions) {
      const conditionValidation = this.validateCondition(condition);
      if (!conditionValidation.success) {
        errors.push(conditionValidation.error);
      }
    }

    this._validationErrors = errors;
    this._lastValidationTime = new Date();

    if (errors.length > 0) {
      return { success: false, error: errors[0] };
    }

    return { success: true, data: undefined };
  }

  /**
   * Creates a copy of the dependency with modified properties.
   */
  withModifications(modifications: {
    versionConstraint?: VersionConstraint;
    isOptional?: boolean;
    loadOrder?: number;
    conditions?: readonly DependencyCondition[];
  }): DependencyEntity {
    return new DependencyEntity(
      this._pluginId,
      this._pluginName,
      modifications.versionConstraint ?? this._versionConstraint,
      modifications.isOptional ?? this._isOptional,
      modifications.loadOrder ?? this._loadOrder,
      modifications.conditions ?? this._conditions
    );
  }

  /**
   * Compares this dependency with another for equality.
   */
  equals(other: DependencyEntity): boolean {
    return (
      this._pluginId === other._pluginId &&
      this._pluginName === other._pluginName &&
      this.versionConstraintsEqual(this._versionConstraint, other._versionConstraint) &&
      this._isOptional === other._isOptional &&
      this._loadOrder === other._loadOrder &&
      this.conditionsEqual(this._conditions, other._conditions)
    );
  }

  /**
   * Gets dependency statistics.
   */
  getStats(): DependencyStats {
    return {
      pluginId: this._pluginId,
      pluginName: this._pluginName,
      isResolved: this._isResolved,
      isOptional: this._isOptional,
      hasConditions: this._conditions.length > 0,
      validationErrors: this._validationErrors.length,
      lastValidationTime: this._lastValidationTime,
      resolvedVersion: this._resolvedVersion,
    };
  }

  /**
   * Converts to plain object for serialization.
   */
  toPlainObject(): DependencyPlainObject {
    return {
      pluginId: this._pluginId,
      pluginName: this._pluginName,
      versionConstraint: this._versionConstraint,
      isOptional: this._isOptional,
      loadOrder: this._loadOrder,
      conditions: this._conditions,
      isResolved: this._isResolved,
      resolvedVersion: this._resolvedVersion,
    };
  }

  /**
   * Creates dependency from plain object.
   */
  static fromPlainObject(obj: DependencyPlainObject): DependencyEntity {
    const dependency = new DependencyEntity(
      obj.pluginId,
      obj.pluginName,
      obj.versionConstraint,
      obj.isOptional,
      obj.loadOrder,
      obj.conditions
    );

    if (obj.isResolved && obj.resolvedVersion) {
      dependency.resolve(obj.resolvedVersion);
    }

    return dependency;
  }

  /**
   * Validates the dependency definition during construction.
   */
  private validateDependency(): void {
    const result = this.validate();
    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Evaluates a version constraint against a version.
   */
  private evaluateVersionConstraint(constraint: VersionConstraint, version: SemVer): boolean {
    const { operator, version: constraintVersion } = constraint;
    const constraintSemVer = parseVersion(constraintVersion);

    switch (operator) {
      case '=':
        return this.versionsEqual(version, constraintSemVer);
      case '>=':
        return this.compareVersions(version, constraintSemVer) >= 0;
      case '>':
        return this.compareVersions(version, constraintSemVer) > 0;
      case '<=':
        return this.compareVersions(version, constraintSemVer) <= 0;
      case '<':
        return this.compareVersions(version, constraintSemVer) < 0;
      case '^':
        return this.satisfiesCaretRange(version, constraintSemVer);
      case '~':
        return this.satisfiesTildeRange(version, constraintSemVer);
      case '*':
        return true;
      default:
        return false;
    }
  }

  /**
   * Evaluates a dependency condition.
   */
  private evaluateCondition(
    condition: DependencyCondition,
    context: Record<string, unknown>
  ): boolean {
    const { key, value, operator } = condition;
    const contextValue = context[key];

    switch (operator) {
      case '=':
        return contextValue === value;
      case '!=':
        return contextValue !== value;
      case 'exists':
        return key in context;
      case 'not_exists':
        return !(key in context);
      default:
        return false;
    }
  }

  /**
   * Validates a version constraint.
   */
  private validateVersionConstraint(constraint: VersionConstraint): Result<void, DependencyError> {
    if (!constraint.operator) {
      return {
        success: false,
        error: new DependencyError(
          ConflictType.VERSION_MISMATCH,
          undefined,
          'Version constraint operator is required'
        ),
      };
    }

    if (!constraint.version) {
      return {
        success: false,
        error: new DependencyError(
          ConflictType.VERSION_MISMATCH,
          undefined,
          'Version constraint version is required'
        ),
      };
    }

    // Validate version format by trying to parse it
    try {
      parseVersion(constraint.version);
    } catch {
      return {
        success: false,
        error: new DependencyError(
          ConflictType.VERSION_MISMATCH,
          { required: 'valid semver format', found: constraint.version as string },
          `Invalid version format: ${constraint.version}`
        ),
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validates a dependency condition.
   */
  private validateCondition(condition: DependencyCondition): Result<void, DependencyError> {
    if (!condition.type || !condition.key || !condition.operator) {
      return {
        success: false,
        error: new DependencyError(
          ConflictType.CONDITION_CONFLICT,
          undefined,
          'Invalid dependency condition'
        ),
      };
    }

    return { success: true, data: undefined };
  }

  /**
   * Compares two versions.
   */
  private compareVersions(a: SemVer, b: SemVer): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;
    return 0;
  }

  /**
   * Checks if two versions are equal.
   */
  private versionsEqual(a: SemVer, b: SemVer): boolean {
    return this.compareVersions(a, b) === 0;
  }

  /**
   * Checks if version satisfies caret range (^).
   */
  private satisfiesCaretRange(version: SemVer, constraint: SemVer): boolean {
    return version.major === constraint.major && this.compareVersions(version, constraint) >= 0;
  }

  /**
   * Checks if version satisfies tilde range (~).
   */
  private satisfiesTildeRange(version: SemVer, constraint: SemVer): boolean {
    return (
      version.major === constraint.major &&
      version.minor === constraint.minor &&
      version.patch >= constraint.patch
    );
  }

  /**
   * Checks if two version constraints are equal.
   */
  private versionConstraintsEqual(a: VersionConstraint, b: VersionConstraint): boolean {
    return (
      a.operator === b.operator &&
      this.versionsEqual(parseVersion(a.version), parseVersion(b.version))
    );
  }

  /**
   * Checks if two condition arrays are equal.
   */
  private conditionsEqual(
    a: readonly DependencyCondition[],
    b: readonly DependencyCondition[]
  ): boolean {
    if (a.length !== b.length) return false;

    return a.every((condA, index) => {
      const condB = b[index];
      return (
        condA.type === condB.type &&
        condA.key === condB.key &&
        condA.value === condB.value &&
        condA.operator === condB.operator
      );
    });
  }
}

/**
 * Dependency statistics interface.
 */
export interface DependencyStats {
  readonly pluginId: PluginId;
  readonly pluginName: PluginName;
  readonly isResolved: boolean;
  readonly isOptional: boolean;
  readonly hasConditions: boolean;
  readonly validationErrors: number;
  readonly lastValidationTime?: Date;
  readonly resolvedVersion?: SemVer;
}

/**
 * Plain object representation for serialization.
 */
export interface DependencyPlainObject {
  readonly pluginId: PluginId;
  readonly pluginName: PluginName;
  readonly versionConstraint: VersionConstraint;
  readonly isOptional: boolean;
  readonly loadOrder: number;
  readonly conditions: readonly DependencyCondition[];
  readonly isResolved: boolean;
  readonly resolvedVersion?: SemVer;
}
