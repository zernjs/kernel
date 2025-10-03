/**
 * @file Recommended Usage Pattern
 * @description The simplest and best way to use Zern Kernel
 */

import { createKernel, plugin } from '../src';

// ============================================================================
// 1. Define your plugins
// ============================================================================

const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number): number => a + b,
  subtract: (a: number, b: number): number => a - b,
  multiply: (a: number, b: number): number => a * b,
  divide: (a: number, b: number): number => {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  },
}));

const calculatorPlugin = plugin('calculator', '1.0.0').setup(() => ({
  square: (x: number): number => x * x,
  cube: (x: number): number => x * x * x,
  pow: (base: number, exponent: number): number => Math.pow(base, exponent),
}));

// ============================================================================
// 2. Initialize and EXPORT the kernel
// ============================================================================

export const kernel = await createKernel().use(mathPlugin).use(calculatorPlugin).start();

console.log('✅ Kernel initialized and exported!');

// ============================================================================
// 3. Use it anywhere with FULL type safety!
// ============================================================================

// In this file or any other file that imports { kernel }
const math = kernel.get('math');
console.log('\n📝 Using kernel.get():');
console.log('  math.add(10, 5) =', math.add(10, 5));
console.log('  math.multiply(7, 3) =', math.multiply(7, 3));

const calc = kernel.get('calculator');
console.log('\n📝 Using calculator:');
console.log('  calc.square(5) =', calc.square(5));
console.log('  calc.cube(3) =', calc.cube(3));

// ============================================================================
// That's it! Simple, type-safe, and powerful. ✨
// ============================================================================

console.log('\n✅ Benefits:');
console.log('  ✓ Full TypeScript autocomplete');
console.log('  ✓ Zero boilerplate');
console.log('  ✓ Import kernel anywhere');
console.log('  ✓ All plugin extensions work automatically');
