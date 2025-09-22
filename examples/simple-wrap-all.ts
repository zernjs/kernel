/**
 * Example of using the wrapper system with automatic context sharing
 * Demonstrates how properties added in 'before' are automatically available in 'after'
 */

import { plugin, createKernel } from '../src';

// ============================================================================
// SIMPLE PLUGIN: Calculator
// ============================================================================

const calculatorPlugin = plugin('calculator', '1.0.0').setup(() => ({
  add: (a: number, b: number): number => a + b,
  multiply: (a: number, b: number): number => a * b,
  divide: (a: number, b: number): number => {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  },
}));

// ============================================================================
// EXAMPLE 1: SIMPLE LOGGING
// ============================================================================

console.log('🚀 Example 1: Simple Logging\n');

// Create wrapper plugin - SIMPLE!
const loggingPlugin = plugin('logging', '1.0.0')
  .wrapAll(calculatorPlugin, {
    wrapper: {
      before: context => {
        console.log(`📝 Calling ${context.methodName} with:`, context.args);
        return { shouldCallOriginal: true };
      },
      after: (result, context) => {
        console.log(`✅ ${context.methodName} returned:`, result);
        return result;
      },
    },
  })
  .setup(() => ({}));

// Use in kernel
const kernel1 = await createKernel().use(calculatorPlugin).use(loggingPlugin).start();

const calc1 = kernel1.get('calculator');

// Test - will log automatically!
calc1.add(2, 3);
calc1.multiply(4, 5);

console.log('\n' + '='.repeat(50) + '\n');

// ============================================================================
// EXAMPLE 2: TIME MEASUREMENT
// ============================================================================

console.log('🚀 Example 2: Time Measurement\n');
// SIMPLE configuration for timing

// Timing wrapper plugin
const timingPlugin = plugin('timing', '1.0.0')
  .wrapAll(calculatorPlugin, {
    wrapper: {
      before: context => {
        context.startTime = Date.now();
        return { shouldCallOriginal: true };
      },
      after: (result, context) => {
        const endTime = Date.now();
        const startTime = context.startTime as number;
        const duration = endTime - startTime;
        console.log(`⏱️ ${context.methodName} took ${duration.toFixed(2)}ms`);
        return result;
      },
    },
  })
  .setup(() => ({}));

const kernel2 = await createKernel().use(calculatorPlugin).use(timingPlugin).build().init();

const calc2 = kernel2.get('calculator');

// Test - will measure time automatically!
calc2.add(10, 20);
calc2.multiply(7, 8);

console.log('\n' + '='.repeat(50) + '\n');

// ============================================================================
// EXAMPLE 3: ERROR HANDLING
// ============================================================================

console.log('🚀 Example 3: Error Handling\n');

// Error wrapper plugin
const errorPlugin = plugin('error-handler', '1.0.0')
  .wrapAll(calculatorPlugin, {
    wrapper: {
      around: context => {
        try {
          const result = context.originalMethod(...context.args);
          return { shouldCallOriginal: false, overrideResult: result };
        } catch (error) {
          console.log(`❌ Error in ${context.methodName}:`, (error as Error).message);
          console.log(`🔧 Returning default value`);
          return { shouldCallOriginal: false, overrideResult: 0 };
        }
      },
    },
  })
  .setup(() => ({}));

const kernel3 = await createKernel().use(calculatorPlugin).use(errorPlugin).build().init();

const calc3 = kernel3.get('calculator');

// Test - will handle error automatically!
calc3.add(5, 5); // Normal
calc3.divide(10, 0); // Error - but will be handled!

console.log('\n' + '='.repeat(50) + '\n');

// ============================================================================
// EXAMPLE 4: MULTIPLE WRAPPERS TOGETHER
// ============================================================================

console.log('🚀 Example 4: Multiple Wrappers\n');

// Combine logging + timing + error handling
const kernel4 = await createKernel()
  .use(calculatorPlugin)
  .use(loggingPlugin) // Adds logging
  .use(timingPlugin) // Adds timing
  .use(errorPlugin) // Adds error handling
  .start();

const calc4 = kernel4.get('calculator');

console.log('🎯 Normal operation with all wrappers:');
calc4.multiply(6, 7);

console.log('\n🎯 Error operation with all wrappers:');
calc4.divide(15, 0);

console.log("\n🎉 Done! That's all you need to know about wrapAll!");
