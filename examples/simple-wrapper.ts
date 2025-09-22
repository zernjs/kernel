/**
 * @file Simple wrapper example
 * @description Basic example showing how to wrap methods with additional functionality
 */

import { plugin, createKernel } from '../src';

// Base plugin with a simple API
const calculatorPlugin = plugin('calculator', '1.0.0').setup(() => ({
  multiply: (a: number, b: number): number => {
    return a * b;
  },

  power: (base: number, exponent: number): number => {
    return Math.pow(base, exponent);
  },
}));

// Plugin that adds logging to calculator methods
const loggerPlugin = plugin('logger', '1.0.0')
  // Wrap the multiply method with logging - NOW WITH AUTO-TYPED PARAMETERS! 🎉
  .wrap(calculatorPlugin, 'multiply', {
    before: context => {
      const [a, b] = context.args; // TypeScript automatically knows this is [number, number]
      console.log(`[BEFORE] Calling multiply(${a}, ${b})`);
      return { shouldCallOriginal: true };
    },
    after: result => {
      console.log(`[AFTER] multiply result: ${result}`); // TypeScript knows result is number
      return result;
    },
  })
  // Wrap the power method with validation and logging - ALSO AUTO-TYPED! 🎉
  .wrap(calculatorPlugin, 'power', {
    before: context => {
      const [base, exponent] = context.args; // TypeScript automatically knows this is [number, number]

      // Validation
      if (typeof base !== 'number' || typeof exponent !== 'number') {
        console.log(`[VALIDATION] Invalid arguments: base=${base}, exponent=${exponent}`);
        throw new Error('Both arguments must be numbers');
      }

      console.log(`[BEFORE] Calling power(${base}, ${exponent})`);
      return { shouldCallOriginal: true };
    },
    after: result => {
      console.log(`[AFTER] power result: ${result}`); // TypeScript knows result is number
      return result;
    },
  })
  .setup((): { info: (message: string) => void; error: (message: string) => void } => ({
    info: (message: string): void => console.log(`[INFO] ${message}`),
    error: (message: string): void => console.error(`[ERROR] ${message}`),
  }));

// Plugin that adds timing to methods - ALSO AUTO-TYPED! 🎉
const timerPlugin = plugin('timer', '1.0.0')
  .wrap(calculatorPlugin, 'power', {
    around: context => {
      const startTime = Date.now();
      console.log(`[TIMER] Starting ${context.methodName}`);

      try {
        // Call the original method - TypeScript knows the signature!
        const result = context.originalMethod(...context.args);
        const endTime = Date.now();
        console.log(`[TIMER] ${context.methodName} took ${endTime - startTime}ms`);

        return {
          shouldCallOriginal: false,
          overrideResult: result,
        };
      } catch (error) {
        const endTime = Date.now();
        console.log(`[TIMER] ${context.methodName} failed after ${endTime - startTime}ms`);
        throw error;
      }
    },
  })
  .setup((_deps): { startTime: number } => ({
    startTime: 0,
  }));

// Usage example
async function runSimpleExample(): Promise<void> {
  console.log('=== Simple Wrapper Example with Auto-Typed Wrappers ===\n');

  // Create kernel with plugins
  const kernel = await createKernel()
    .use(calculatorPlugin)
    .use(loggerPlugin)
    .use(timerPlugin)
    .build()
    .init();

  // Get calculator with proper typing - methods remain synchronous as originally defined
  const calculator = kernel.get('calculator');

  console.log('1. Testing multiply with logging:');
  try {
    const multiplyResult = calculator.multiply(6, 7); // Synchronous call - no await needed!
    console.log(`Final result: ${multiplyResult}\n`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error:', errorMessage);
  }

  console.log('2. Testing power with validation, logging, and timing:');
  try {
    const powerResult = calculator.power(2, 8); // Synchronous call - no await needed!
    console.log(`Final result: ${powerResult}\n`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error:', errorMessage);
  }

  console.log('\n=== Example Complete ===');
}

// Export for testing
export { calculatorPlugin, loggerPlugin, timerPlugin, runSimpleExample };

// Run example if this file is executed directly
runSimpleExample().catch(console.error);
