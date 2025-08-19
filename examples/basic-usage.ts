import { plugin, createKernel } from '@/index';

// Plugin de logger
const loggerPlugin = plugin('logger', '1.0.0').setup(() => ({
  log: (msg: string): void => console.log(`[LOG] ${msg}`),
  error: (msg: string): void => console.error(`[ERROR] ${msg}`),
}));

// Plugin de matemática com dependência
const mathPlugin = plugin('math', '1.0.0')
  .depends(loggerPlugin, '^1.0.0')
  .setup(({ plugins }) => ({
    add: (a: number, b: number): number => {
      plugins.logger.log(`Adding ${a} + ${b}`);
      return a + b;
    },
    multiply: (a: number, b: number): number => {
      plugins.logger.log(`Multiplying ${a} * ${b}`);
      return a * b;
    },
  }));

// Plugin que estende matemática
const advancedMathPlugin = plugin('advanced-math', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .extend(mathPlugin, _mathApi => {
    return {
      power: (base: number, exp: number): number => Math.pow(base, exp),
      sqrt: (value: number): number => Math.sqrt(value),
    };
  })
  .setup(() => {
    function factorial(n: number): number {
      return n <= 1 ? 1 : n * factorial(n - 1);
    }

    return {
      factorial,
    };
  });

// Criar e inicializar kernel
const kernel = await createKernel()
  .use(loggerPlugin)
  .use(mathPlugin)
  .use(advancedMathPlugin)
  .withConfig({ logLevel: 'debug' })
  .start();

// Usar plugins com type safety completo
const logger = kernel.get('logger'); // Tipo inferido automaticamente
const math = kernel.get('math'); // Inclui métodos estendidos

logger.log('Kernel initialized!');
const result = math.add(2, 3); // Autocomplete funciona
const power = math.power(2, 3); // Método estendido disponível

console.log(`2 + 3 = ${result}`);
console.log(`2^3 = ${power}`);

// Shutdown graceful
await kernel.shutdown();
