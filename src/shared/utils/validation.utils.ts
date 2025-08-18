/**
 * Utilitários de validação para o Zern Kernel
 */

import { Result, success, failure } from '../types/result.types';
import { ValidationError, InvalidVersionError, InvalidPluginNameError } from '../types/error.types';
import { PluginName, Version } from '../types/common.types';
import { isPluginName, isVersion, isNonEmptyString, isValidNumber, isObject } from './type.guards';

/**
 * Valida um nome de plugin
 */
export function validatePluginName(name: unknown): Result<PluginName, InvalidPluginNameError> {
  if (!isNonEmptyString(name)) {
    return failure(new InvalidPluginNameError('Plugin name must be a non-empty string'));
  }

  if (!isPluginName(name)) {
    return failure(
      new InvalidPluginNameError(
        'Plugin name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens'
      )
    );
  }

  return success(name);
}

/**
 * Valida uma versão semântica
 */
export function validateVersion(version: unknown): Result<Version, InvalidVersionError> {
  if (!isNonEmptyString(version)) {
    return failure(new InvalidVersionError('Version must be a non-empty string'));
  }

  if (!isVersion(version)) {
    return failure(
      new InvalidVersionError(`Invalid semantic version format: ${version}. Expected format: x.y.z`)
    );
  }

  return success(version);
}

/**
 * Valida um range de versão
 */
export function validateVersionRange(range: unknown): Result<string, ValidationError> {
  if (!isNonEmptyString(range)) {
    return failure(new ValidationError('Version range must be a non-empty string'));
  }

  // Padrões válidos de range
  const validPatterns = [
    /^\^\d+\.\d+\.\d+/, // ^1.0.0
    /^~\d+\.\d+\.\d+/, // ~1.0.0
    /^>=\d+\.\d+\.\d+/, // >=1.0.0
    /^>\d+\.\d+\.\d+/, // >1.0.0
    /^<=\d+\.\d+\.\d+/, // <=1.0.0
    /^<\d+\.\d+\.\d+/, // <1.0.0
    /^\d+\.\d+\.\d+/, // 1.0.0 (exato)
  ];

  const isValid = validPatterns.some(pattern => pattern.test(range));

  if (!isValid) {
    return failure(
      new ValidationError(
        `Invalid version range format: ${range}. Supported formats: ^x.y.z, ~x.y.z, >=x.y.z, >x.y.z, <=x.y.z, <x.y.z, x.y.z`
      )
    );
  }

  return success(range);
}

/**
 * Valida configuração de timeout
 */
export function validateTimeout(timeout: unknown): Result<number, ValidationError> {
  if (!isValidNumber(timeout)) {
    return failure(new ValidationError('Timeout must be a valid number'));
  }

  if (timeout < 0) {
    return failure(new ValidationError('Timeout must be non-negative'));
  }

  if (timeout > 300000) {
    // 5 minutos
    return failure(new ValidationError('Timeout cannot exceed 300000ms (5 minutes)'));
  }

  return success(timeout);
}

/**
 * Valida configuração de retries
 */
export function validateRetries(retries: unknown): Result<number, ValidationError> {
  if (!isValidNumber(retries)) {
    return failure(new ValidationError('Retries must be a valid number'));
  }

  if (!Number.isInteger(retries)) {
    return failure(new ValidationError('Retries must be an integer'));
  }

  if (retries < 0) {
    return failure(new ValidationError('Retries must be non-negative'));
  }

  if (retries > 10) {
    return failure(new ValidationError('Retries cannot exceed 10'));
  }

  return success(retries);
}

/**
 * Valida uma configuração completa
 */
export function validateConfig(config: unknown): Result<Record<string, unknown>, ValidationError> {
  if (!isObject(config)) {
    return failure(new ValidationError('Config must be an object'));
  }

  const validatedConfig: Record<string, unknown> = {};

  // Validar timeout se presente
  if ('timeout' in config && config.timeout !== undefined) {
    const timeoutResult = validateTimeout(config.timeout);
    if (!timeoutResult.success) {
      return timeoutResult;
    }
    validatedConfig.timeout = timeoutResult.data;
  }

  // Validar retries se presente
  if ('retries' in config && config.retries !== undefined) {
    const retriesResult = validateRetries(config.retries);
    if (!retriesResult.success) {
      return retriesResult;
    }
    validatedConfig.retries = retriesResult.data;
  }

  // Validar debug se presente
  if ('debug' in config && config.debug !== undefined) {
    if (typeof config.debug !== 'boolean') {
      return failure(new ValidationError('Debug flag must be a boolean'));
    }
    validatedConfig.debug = config.debug;
  }

  // Copiar outras propriedades válidas
  for (const [key, value] of Object.entries(config)) {
    if (!['timeout', 'retries', 'debug'].includes(key)) {
      validatedConfig[key] = value;
    }
  }

  return success(validatedConfig);
}

/**
 * Valida uma lista de dependências
 */
export function validateDependencies(
  dependencies: unknown
): Result<Array<{ name: PluginName; version: string }>, ValidationError> {
  if (!Array.isArray(dependencies)) {
    return failure(new ValidationError('Dependencies must be an array'));
  }

  const validatedDeps: Array<{ name: PluginName; version: string }> = [];

  for (let i = 0; i < dependencies.length; i++) {
    const dep = dependencies[i];

    if (!isObject(dep)) {
      return failure(new ValidationError(`Dependency at index ${i} must be an object`));
    }

    if (!('name' in dep) || !('version' in dep)) {
      return failure(
        new ValidationError(`Dependency at index ${i} must have 'name' and 'version' properties`)
      );
    }

    const nameResult = validatePluginName(dep.name);
    if (!nameResult.success) {
      return failure(
        new ValidationError(`Invalid dependency name at index ${i}: ${nameResult.error.message}`)
      );
    }

    const versionResult = validateVersionRange(dep.version);
    if (!versionResult.success) {
      return failure(
        new ValidationError(
          `Invalid dependency version at index ${i}: ${versionResult.error.message}`
        )
      );
    }

    validatedDeps.push({
      name: nameResult.data,
      version: versionResult.data,
    });
  }

  return success(validatedDeps);
}

/**
 * Valida que um objeto tem propriedades obrigatórias
 */
export function validateRequiredProperties<T extends Record<string, unknown>>(
  obj: unknown,
  requiredKeys: (keyof T)[],
  objectName = 'object'
): Result<T, ValidationError> {
  if (!isObject(obj)) {
    return failure(new ValidationError(`${objectName} must be an object`));
  }

  const typedObj = obj as Record<string, unknown>;
  for (const key of requiredKeys) {
    if (!(key in typedObj) || typedObj[key as string] === undefined) {
      return failure(
        new ValidationError(`${objectName} is missing required property: ${String(key)}`)
      );
    }
  }

  return success(typedObj as T);
}
