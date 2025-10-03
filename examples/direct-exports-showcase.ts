/**
 * @file Direct Exports Showcase
 * @description Demonstrates the direct exports system with full type safety
 */

import { plugin, createKernel, createDirectExports } from '../src';
import { mathPlugin } from './math-plugin/src';

// ============================================================================
// Scientific Plugin - Extends math plugin with scientific functions
// ============================================================================

export const scientificPlugin = plugin('scientific', '1.0.0')
  .depends(mathPlugin, '^1.0.0')
  .extend(mathPlugin, () => ({
    // Add scientific methods to math plugin
    log: (x: number): number => Math.log(x),
    exp: (x: number): number => Math.exp(x),
    pow10: (x: number): number => Math.pow(10, x),
    ln: (x: number): number => Math.log(x), // Natural log (alias)
  }))
  .setup(() => ({
    // Scientific plugin's own methods
    calculateE: (): number => Math.E,
    calculatePi: (): number => Math.PI,
    toDegrees: (radians: number): number => (radians * 180) / Math.PI,
    toRadians: (degrees: number): number => (degrees * Math.PI) / 180,
  }));

// ============================================================================
// Direct Method Exports - Type-safe, importable methods
// ============================================================================

// Export extended methods (these will be available on math plugin at runtime)
export const { log, exp, pow10, ln } = createDirectExports('math', {
  log: (_x: number): number => 0,
  exp: (_x: number): number => 0,
  pow10: (_x: number): number => 0,
  ln: (_x: number): number => 0,
});

// Export own methods (these are specific to scientific plugin)
export const { calculateE, calculatePi, toDegrees, toRadians } = createDirectExports('scientific', {
  calculateE: (): number => 0,
  calculatePi: (): number => 0,
  toDegrees: (_radians: number): number => 0,
  toRadians: (_degrees: number): number => 0,
});

// ============================================================================
// Usage Example
// ============================================================================

async function demonstrateDirectExports(): Promise<void> {
  console.log('=== Direct Exports Showcase ===\n');

  // Initialize kernel with plugins
  const kernel = await createKernel().use(mathPlugin).use(scientificPlugin).start();

  console.log('✅ Kernel initialized with math and scientific plugins\n');

  // ============================================================================
  // Pattern 1: Via kernel.get() - Traditional approach
  // ============================================================================

  console.log('📝 Pattern 1: Using kernel.get()');
  const math = kernel.get('math');
  console.log('  math.log(Math.E) =', math.log(Math.E)); // Extended method!
  console.log('  math.exp(1) =', math.exp(1)); // Extended method!

  const scientific = kernel.get('scientific');
  console.log('  scientific.calculatePi() =', scientific.calculatePi());
  console.log();

  // ============================================================================
  // Pattern 2: Direct imports - Library-like usage
  // ============================================================================

  console.log('📝 Pattern 2: Using direct imports (like a library)');
  // These are imported at the top of the file
  console.log('  log(Math.E) =', log(Math.E)); // ✅ Works! Type-safe!
  console.log('  exp(1) =', exp(1)); // ✅ Works! Type-safe!
  console.log('  pow10(2) =', pow10(2)); // ✅ Works! Type-safe!
  console.log('  calculatePi() =', calculatePi()); // ✅ Works! Type-safe!
  console.log('  toDegrees(Math.PI) =', toDegrees(Math.PI)); // ✅ Works! Type-safe!
  console.log();

  // ============================================================================
  // Type Safety Demonstration
  // ============================================================================

  console.log('📝 Type Safety:');
  console.log('  ✅ log() expects (x: number) => number');
  console.log('  ✅ TypeScript will error if you pass wrong types');
  console.log('  ✅ Autocomplete works perfectly in your IDE');
  console.log();

  // ============================================================================
  // Extended Methods Available on Math Plugin
  // ============================================================================

  console.log('📝 Math plugin now has extended methods:');
  const mathAPI = kernel.get('math');
  console.log('  Base methods: add, subtract, multiply, divide, etc.');
  console.log('  Extended methods: log, exp, pow10, ln ✨');
  console.log('  mathAPI.log =', typeof mathAPI.log); // "function"
  console.log();

  console.log('=== Showcase Complete ===');
}

// Run the demonstration
demonstrateDirectExports().catch(console.error);
