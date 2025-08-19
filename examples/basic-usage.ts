import { plugin, createKernel } from '../src';

// Logger Plugin
const loggerPlugin = plugin('logger', '1.0.0').setup(() => ({
  log: (msg: string): void => console.log(`[LOG] ${msg}`),
  error: (msg: string): void => console.error(`[ERROR] ${msg}`),
}));

// Math plugin with dependencies
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

// Advanced Math plugin with dependencies
// This plugin extends the math plugin API
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

// Create and initialize kernel
const kernel = await createKernel()
  .use(loggerPlugin)
  .use(mathPlugin)
  .use(advancedMathPlugin)
  .withConfig({ logLevel: 'debug' })
  .start();

// Use plugins with type safety
const logger = kernel.get('logger'); // Type inference
const math = kernel.get('math'); // Includes extended methods
const advancedMath = kernel.get('advanced-math'); // Includes extended methods

logger.log('Kernel initialized!');
const result = math.add(2, 3); // Autocomplete works
const power = math.power(2, 3); // Extended method available
const factorial = advancedMath.factorial(5); // Extended method available

console.log(`2 + 3 = ${result}`);
console.log(`2^3 = ${power}`);
console.log(`5! = ${factorial}`);

// Shutdown graceful
await kernel.shutdown();
