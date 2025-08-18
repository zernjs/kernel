/**
 * Constantes relacionadas ao kernel
 */

/**
 * Configurações padrão do kernel
 */
export const KERNEL_DEFAULTS = {
  TIMEOUT: 30000, // 30 segundos
  RETRIES: 3,
  DEBUG: false,
  MAX_PLUGINS: 1000,
  MAX_DEPENDENCY_DEPTH: 50,
} as const;

/**
 * Timeouts específicos
 */
export const TIMEOUTS = {
  PLUGIN_LOAD: 10000, // 10 segundos
  PLUGIN_INIT: 15000, // 15 segundos
  DEPENDENCY_RESOLUTION: 5000, // 5 segundos
  KERNEL_SHUTDOWN: 30000, // 30 segundos
} as const;

/**
 * Limites de retry
 */
export const RETRY_LIMITS = {
  PLUGIN_LOAD: 3,
  DEPENDENCY_RESOLUTION: 2,
  INITIALIZATION: 1,
} as const;

/**
 * Eventos do kernel
 */
export const KERNEL_EVENTS = {
  BEFORE_BUILD: 'kernel:before-build',
  AFTER_BUILD: 'kernel:after-build',
  BEFORE_INIT: 'kernel:before-init',
  AFTER_INIT: 'kernel:after-init',
  BEFORE_SHUTDOWN: 'kernel:before-shutdown',
  AFTER_SHUTDOWN: 'kernel:after-shutdown',
  ERROR: 'kernel:error',
} as const;

/**
 * Estados válidos do kernel
 */
export const KERNEL_STATES = {
  UNINITIALIZED: 'uninitialized',
  BUILDING: 'building',
  BUILT: 'built',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  ERROR: 'error',
  DESTROYED: 'destroyed',
} as const;

/**
 * Prioridades de inicialização
 */
export const INIT_PRIORITIES = {
  HIGHEST: 0,
  HIGH: 25,
  NORMAL: 50,
  LOW: 75,
  LOWEST: 100,
} as const;

/**
 * Configurações de logging
 */
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
} as const;

/**
 * Prefixos para logs
 */
export const LOG_PREFIXES = {
  KERNEL: '[KERNEL]',
  PLUGIN: '[PLUGIN]',
  DEPENDENCY: '[DEPENDENCY]',
  EXTENSION: '[EXTENSION]',
} as const;

/**
 * Configurações de performance
 */
export const PERFORMANCE = {
  MAX_CONCURRENT_LOADS: 10,
  BATCH_SIZE: 50,
  CACHE_TTL: 300000, // 5 minutos
} as const;
