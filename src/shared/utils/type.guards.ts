/**
 * Type guards para validação de tipos em runtime
 */

import { PluginId, KernelId, Version, PluginName, LifecycleState } from '../types';

/**
 * Verifica se um valor é uma string não vazia
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Verifica se um valor é um número válido
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Verifica se um valor é um objeto não nulo
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Verifica se um valor é uma função
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Verifica se um valor é um array não vazio
 */
export function isNonEmptyArray<T>(value: unknown): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Verifica se um valor é um PluginId válido
 */
export function isPluginId(value: unknown): value is PluginId {
  return isNonEmptyString(value);
}

/**
 * Verifica se um valor é um KernelId válido
 */
export function isKernelId(value: unknown): value is KernelId {
  return isNonEmptyString(value);
}

/**
 * Verifica se um valor é um PluginName válido
 */
export function isPluginName(value: unknown): value is PluginName {
  if (!isNonEmptyString(value)) {
    return false;
  }

  // Plugin name deve começar com letra minúscula e conter apenas letras, números e hífens
  return /^[a-z][a-z0-9-]*$/.test(value);
}

/**
 * Verifica se um valor é uma Version válida
 */
export function isVersion(value: unknown): value is Version {
  if (!isNonEmptyString(value)) {
    return false;
  }

  // Regex para versão semântica
  const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(value);
}

/**
 * Verifica se um valor é um LifecycleState válido
 */
export function isLifecycleState(value: unknown): value is LifecycleState {
  return (
    typeof value === 'string' && Object.values(LifecycleState).includes(value as LifecycleState)
  );
}

/**
 * Verifica se um valor é uma configuração válida
 */
export function isValidConfig(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) {
    return false;
  }

  // Verificações específicas para configuração
  const config = value as Record<string, unknown>;

  if (config.timeout !== undefined && !isValidNumber(config.timeout)) {
    return false;
  }

  if (config.retries !== undefined && !isValidNumber(config.retries)) {
    return false;
  }

  if (config.debug !== undefined && typeof config.debug !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Verifica se um valor é uma dependência de plugin válida
 */
export function isValidPluginDependency(
  value: unknown
): value is { name: PluginName; version: string } {
  if (!isObject(value)) {
    return false;
  }

  const dep = value as Record<string, unknown>;

  return isPluginName(dep.name) && isNonEmptyString(dep.version);
}

/**
 * Verifica se um valor tem todas as propriedades obrigatórias
 */
export function hasRequiredProperties<T extends Record<string, unknown>>(
  value: unknown,
  requiredKeys: (keyof T)[]
): value is T {
  if (!isObject(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return requiredKeys.every(key => key in obj && obj[key as string] !== undefined);
}

/**
 * Verifica se um valor é uma Promise
 */
export function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'then' in value &&
    isFunction((value as Record<string, unknown>).then)
  );
}

/**
 * Verifica se um valor é um Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Verifica se um valor é undefined ou null
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Verifica se um valor não é undefined nem null
 */
export function isNotNullish<T>(value: T | null | undefined): value is T {
  return !isNullish(value);
}
