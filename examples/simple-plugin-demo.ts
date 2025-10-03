/**
 * Simple Plugin Demo - Shows how to use the minimal boilerplate
 */

import { createKernel } from '../src';
import { counterPlugin } from './simple-plugin/src';

async function main(): Promise<void> {
  console.log('🚀 Simple Plugin Demo\n');

  // ============================================================================
  // METHOD 1: Using with Kernel
  // ============================================================================

  console.log('📦 Method 1: Using with Kernel\n');

  const kernel = await createKernel().use(counterPlugin).start();

  const counter = kernel.get('counter');

  console.log('Initial value:', counter.getValue()); // 0

  counter.increment();
  counter.increment();
  console.log('After 2 increments:', counter.getValue()); // 2

  counter.decrement();
  console.log('After 1 decrement:', counter.getValue()); // 1

  counter.reset();
  console.log('After reset:', counter.getValue()); // 0

  // Enable logging
  counter.configure({ enableLogging: true });
  console.log('\n📝 Logging enabled:\n');

  counter.increment();
  counter.increment();
  counter.increment();

  // Test bounds
  console.log('\n🔒 Testing bounds:\n');
  counter.configure({ maxValue: 5 });
  counter.increment(); // Should clamp at 5
  counter.increment(); // Should stay at 5

  console.log('Final value:', counter.getValue());

  await kernel.shutdown();

  // ============================================================================
  // METHOD 2: Using Direct API (after kernel started)
  // ============================================================================

  console.log('\n─'.repeat(60));
  console.log('📦 Method 2: Direct API (requires kernel to be started first)\n');

  // Start kernel again
  await createKernel().use(counterPlugin).start();

  // Now we can use direct imports
  const { increment, getValue, reset } = await import('./simple-plugin/src');

  console.log('Initial:', getValue());
  increment();
  increment();
  console.log('After 2 increments:', getValue());
  reset();
  console.log('After reset:', getValue());

  console.log('\n✨ Demo completed!\n');
}

main().catch(console.error);
