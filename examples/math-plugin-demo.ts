/**
 * Math Plugin Demo - Demonstrates the opinionated boilerplate
 */

import { createKernel } from '../src';
import { mathPlugin } from './math-plugin/src';

async function main(): Promise<void> {
  console.log('🧮 Math Plugin Demo (Opinionated Boilerplate)\n');

  // ============================================================================
  // START KERNEL
  // ============================================================================

  const kernel = await createKernel().use(mathPlugin).start();

  const math = kernel.get('math');

  // ============================================================================
  // BASIC OPERATIONS
  // ============================================================================

  console.log('📐 Basic Operations:\n');

  console.log('2 + 3 =', math.add(2, 3)); // 5
  console.log('10 - 4 =', math.subtract(10, 4)); // 6
  console.log('5 × 6 =', math.multiply(5, 6)); // 30
  console.log('15 ÷ 3 =', math.divide(15, 3)); // 5

  // ============================================================================
  // ADVANCED OPERATIONS
  // ============================================================================

  console.log('\n🔬 Advanced Operations:\n');

  console.log('2^10 =', math.power(2, 10)); // 1024
  console.log('√144 =', math.sqrt(144)); // 12
  console.log('5! =', math.factorial(5)); // 120

  // ============================================================================
  // UTILITIES
  // ============================================================================

  console.log('\n🛠️  Utilities:\n');

  console.log('Is 4 even?', math.isEven(4)); // true
  console.log('Is 7 odd?', math.isOdd(7)); // true
  console.log('Round 3.14159 to 2 decimals:', math.round(3.14159, 2)); // 3.14

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  console.log('\n⚙️  Configuration:\n');

  console.log('Current precision:', math.getConfig().precision); // 2

  // Enable logging
  math.configure({ enableLogging: true, precision: 3 });
  console.log('\n📝 Logging enabled:\n');

  math.add(1, 2);
  math.multiply(3, 4);

  // ============================================================================
  // HISTORY
  // ============================================================================

  console.log('\n📜 Operation History:\n');

  const history = math.getHistory();
  console.log(`Total operations: ${history.length}`);
  console.log('Last 3 operations:');
  history.slice(-3).forEach(op => {
    console.log(`  - ${op.operation}(${op.operands.join(', ')}) = ${op.result}`);
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  console.log('\n❌ Error Handling:\n');

  try {
    math.divide(10, 0);
  } catch (error) {
    const err = error as Error & { code?: string; context?: unknown };
    console.log('Caught error:', err.message);
    console.log('Error code:', err.code);
    console.log('Error context:', err.context);
  }

  try {
    math.sqrt(-1);
  } catch (error) {
    const err = error as Error;
    console.log('Caught error:', err.message);
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  console.log('\n🧹 Cleanup:\n');
  math.clearHistory();
  console.log('History cleared:', math.getHistory().length === 0);

  await kernel.shutdown();

  console.log('\n✨ Demo completed!\n');
}

main().catch(console.error);
