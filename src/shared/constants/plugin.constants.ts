/**
 * Constantes relacionadas aos plugins
 */

/**
 * Configurações padrão dos plugins
 */
export const PLUGIN_DEFAULTS = {
  TIMEOUT: 10000, // 10 segundos
  RETRIES: 2,
  PRIORITY: 50,
  LAZY_LOAD: false,
} as const;

/**
 * Estados do ciclo de vida dos plugins
 */
export const PLUGIN_STATES = {
  UNLOADED: 'unloaded',
  LOADING: 'loading',
  LOADED: 'loaded',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  ERROR: 'error',
  DESTROYED: 'destroyed',
} as const;

/**
 * Eventos dos plugins
 */
export const PLUGIN_EVENTS = {
  BEFORE_LOAD: 'plugin:before-load',
  AFTER_LOAD: 'plugin:after-load',
  BEFORE_INIT: 'plugin:before-init',
  AFTER_INIT: 'plugin:after-init',
  BEFORE_DESTROY: 'plugin:before-destroy',
  AFTER_DESTROY: 'plugin:after-destroy',
  ERROR: 'plugin:error',
  DEPENDENCY_RESOLVED: 'plugin:dependency-resolved',
  EXTENSION_APPLIED: 'plugin:extension-applied',
} as const;

/**
 * Tipos de plugin
 */
export const PLUGIN_TYPES = {
  CORE: 'core',
  EXTENSION: 'extension',
  UTILITY: 'utility',
  SERVICE: 'service',
  MIDDLEWARE: 'middleware',
} as const;

/**
 * Validações de nome de plugin
 */
export const PLUGIN_NAME_RULES = {
  MIN_LENGTH: 2,
  MAX_LENGTH: 50,
  PATTERN: /^[a-z][a-z0-9-]*$/,
  RESERVED_NAMES: ['kernel', 'core', 'system', 'internal', 'global', 'config', 'utils', 'helpers'],
} as const;

/**
 * Limites de dependências
 */
export const DEPENDENCY_LIMITS = {
  MAX_DEPENDENCIES: 20,
  MAX_DEPTH: 10,
  MAX_CIRCULAR_CHECKS: 100,
} as const;

/**
 * Configurações de versionamento
 */
export const VERSION_RULES = {
  PATTERN:
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
  RANGE_PATTERNS: {
    CARET: /^\^\d+\.\d+\.\d+/,
    TILDE: /^~\d+\.\d+\.\d+/,
    GREATER_EQUAL: /^>=\d+\.\d+\.\d+/,
    GREATER: /^>\d+\.\d+\.\d+/,
    LESS_EQUAL: /^<=\d+\.\d+\.\d+/,
    LESS: /^<\d+\.\d+\.\d+/,
    EXACT: /^\d+\.\d+\.\d+/,
  },
} as const;

/**
 * Configurações de extensão
 */
export const EXTENSION_RULES = {
  MAX_EXTENSIONS_PER_PLUGIN: 10,
  MAX_EXTENSION_DEPTH: 5,
  ALLOWED_EXTENSION_TYPES: ['api', 'config', 'lifecycle', 'metadata'],
} as const;

/**
 * Configurações de cache
 */
export const CACHE_CONFIG = {
  PLUGIN_METADATA_TTL: 600000, // 10 minutos
  DEPENDENCY_GRAPH_TTL: 300000, // 5 minutos
  VERSION_RESOLUTION_TTL: 180000, // 3 minutos
  MAX_CACHE_SIZE: 1000,
} as const;

/**
 * Configurações de segurança
 */
export const SECURITY_RULES = {
  MAX_API_METHODS: 50,
  MAX_CONFIG_SIZE: 1024 * 1024, // 1MB
  ALLOWED_CONFIG_TYPES: ['string', 'number', 'boolean', 'object', 'array'],
  FORBIDDEN_PROPERTIES: ['__proto__', 'constructor', 'prototype'],
} as const;

/**
 * Mensagens de erro padrão
 */
export const ERROR_MESSAGES = {
  INVALID_NAME:
    'Plugin name must start with lowercase letter and contain only lowercase letters, numbers, and hyphens',
  INVALID_VERSION: 'Plugin version must follow semantic versioning (x.y.z)',
  DUPLICATE_PLUGIN: 'Plugin with this name already exists',
  DEPENDENCY_NOT_FOUND: 'Required dependency not found',
  CIRCULAR_DEPENDENCY: 'Circular dependency detected',
  VERSION_CONFLICT: 'Version conflict in dependency resolution',
  INITIALIZATION_FAILED: 'Plugin initialization failed',
  EXTENSION_FAILED: 'Plugin extension failed',
} as const;
