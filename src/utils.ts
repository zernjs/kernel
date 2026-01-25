/**
 * Utilitários agnósticos para o Zern Kernel.
 */

/**
 * Verifica se um valor é um objeto simples (não null, não array).
 */
export function isObject(item: unknown): item is Record<string, unknown> {
  return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Realiza um merge profundo de dois objetos.
 * Modifica o objeto alvo (target).
 */
export function deepMerge(target: unknown, source: unknown): unknown {
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return target;
}

/**
 * Gera um UUID v4 agnóstico.
 * Tenta usar crypto.randomUUID se disponível, senão usa Math.random.
 */
export function uuid(): string {
  // eslint-disable-next-line no-undef
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    // eslint-disable-next-line no-undef
    return (crypto as { randomUUID: () => string }).randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
