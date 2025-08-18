import { plugin, createKernel } from '../dist/index.js';

// Plugin de logger simples
const loggerPlugin = plugin('logger', '1.0.0').setup(_deps => {
  return {
    log: (message: string): void => console.log(`[LOG] ${message}`),
    error: (message: string): void => console.error(`[ERROR] ${message}`),
  };
});

// Plugin de matemática simples
const mathPlugin = plugin('math', '1.0.0')
  .depends(loggerPlugin)
  .setup(_deps => {
    return {
      add: (a: number, b: number): number => a + b,
      multiply: (a: number, b: number): number => a * b,
    };
  })
  .extend(loggerPlugin, api => {
    return {
      newLog: (message: string): void => api.log(`[MATH] ${message}`),
    };
  });

async function runExample(): Promise<void> {
  // Criar e inicializar kernel com o novo método start() (combina build + init)
  const kernel = await createKernel().use(loggerPlugin).use(mathPlugin).start();

  // Alternativa: usar build().init() separadamente
  // const kernel = await createKernel().use(loggerPlugin).use(mathPlugin).build().init();

  // Usar os plugins
  const logger = kernel.get('logger');
  const math = kernel.get('math');

  logger.log('Exemplo iniciado');

  const result1 = math.add(2, 3);
  logger.log(`2 + 3 = ${result1}`);

  const result2 = math.multiply(4, 5);
  logger.log(`4 * 5 = ${result2}`);

  logger.log('Exemplo concluído');
}

runExample().catch(console.error);
