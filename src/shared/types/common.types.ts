/**
 * Tipos comuns e branded types para type safety
 */

/**
 * Branded types para IDs únicos
 */
export type PluginId = string & { readonly __brand: 'PluginId' };
export type KernelId = string & { readonly __brand: 'KernelId' };
export type Version = string & { readonly __brand: 'Version' };
export type PluginName = string & { readonly __brand: 'PluginName' };

/**
 * Funções helper para criação de branded types
 */
export function createPluginId(value: string): PluginId {
  if (!value || value.trim().length === 0) {
    throw new Error('Plugin ID cannot be empty');
  }
  return value.trim() as PluginId;
}

export function createKernelId(value: string): KernelId {
  if (!value || value.trim().length === 0) {
    throw new Error('Kernel ID cannot be empty');
  }
  return value.trim() as KernelId;
}

export function createPluginName(value: string): PluginName {
  if (!value || value.trim().length === 0) {
    throw new Error('Plugin name cannot be empty');
  }
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error(
      'Plugin name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens'
    );
  }
  return value.trim() as PluginName;
}

export function createVersion(value: string): Version {
  if (!isValidVersion(value)) {
    throw new Error(`Invalid version: ${value}`);
  }
  return value.trim() as Version;
}

/**
 * Validação de versão semântica
 */
function isValidVersion(version: string): boolean {
  const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}

/**
 * Estados do ciclo de vida
 */
export enum LifecycleState {
  UNLOADED = 'UNLOADED',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  INITIALIZING = 'INITIALIZING',
  INITIALIZED = 'INITIALIZED',
  ERROR = 'ERROR',
  DESTROYED = 'DESTROYED',
}

/**
 * Configuração base
 */
export interface BaseConfig {
  readonly timeout?: number;
  readonly retries?: number;
  readonly debug?: boolean;
}

/**
 * Metadados base
 */
export interface BaseMetadata {
  readonly createdAt: Date;
  readonly updatedAt?: Date;
  readonly version: Version;
}

/**
 * Tipo para funções de setup de plugin
 */
export type SetupFunction<TApi, TDeps = Record<string, unknown>> = (deps: TDeps) => TApi;

/**
 * Tipo para dependências de plugin
 */
export interface PluginDependency {
  readonly name: PluginName;
  readonly version: string; // Range de versão (ex: '^1.0.0')
}

/**
 * Tipo para extensões de plugin
 */
export interface PluginExtension<TApi = unknown> {
  readonly targetPlugin: PluginName;
  readonly extensionApi: TApi;
}

/**
 * Utilitários de tipo
 */
export type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type NonEmptyArray<T> = [T, ...T[]];

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never;
}[keyof T];
