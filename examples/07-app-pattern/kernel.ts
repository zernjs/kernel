import { definePlugin, createKernel } from '../../src';

// 1. Definição de Plugins (normalmente em arquivos separados)
const loggerPlugin = definePlugin({
  name: 'logger',
  version: '1.0.0',
  setup: () => ({
    info: (msg: string): void => console.log(`[INFO] ${msg}`),
  }),
});

const calcPlugin = definePlugin({
  name: 'calculator',
  version: '1.0.0',
  dependencies: [loggerPlugin],
  setup: ctx => ({
    add: (a: number, b: number): number => {
      ctx.plugins.logger.info(`Adding ${a} + ${b}`);
      return a + b;
    },
  }),
});

export const k = createKernel().use(loggerPlugin).use(calcPlugin).startSync();
export type AppKernel = typeof k;
