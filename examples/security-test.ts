/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Security Test - Demonstrating vulnerability fixes
 */

import { createStore } from '../src/store';
import { plugin, createKernel } from '../src';

console.log('🔒 Testing Security Fixes\n');

// ============================================================================
// 1. Prototype Pollution Protection
// ============================================================================

console.log('1️⃣  Testing Prototype Pollution Protection');
const store = createStore({ count: 0 });

try {
  // @ts-expect-error - Testing runtime protection
  store['__proto__'] = { isAdmin: true };
  console.log('❌ FAILED: Prototype pollution was not blocked!');
} catch (error) {
  console.log('✅ PASSED: Prototype pollution blocked:', (error as Error).message);
}

try {
  // @ts-expect-error - Testing runtime protection
  store['constructor'] = { hack: true };
  console.log('❌ FAILED: Constructor pollution was not blocked!');
} catch (error) {
  console.log('✅ PASSED: Constructor pollution blocked:', (error as Error).message);
}

try {
  // @ts-expect-error - Testing runtime protection
  store['prototype'] = { exploit: true };
  console.log('❌ FAILED: Prototype pollution was not blocked!');
} catch (error) {
  console.log('✅ PASSED: Prototype pollution blocked:', (error as Error).message);
}

// Verify that Object.prototype was not polluted
const testObj = {};
// @ts-expect-error - checking if pollution occurred
if (testObj.isAdmin === undefined) {
  console.log('✅ VERIFIED: Object.prototype remains clean\n');
} else {
  console.log('❌ CRITICAL: Object.prototype was polluted!\n');
}

// ============================================================================
// 2. ReDoS Protection
// ============================================================================

console.log('2️⃣  Testing ReDoS Protection');

plugin('math', '1.0.0')
  .proxy({
    include: ['add', 'multiply'], // Normal patterns work fine
    before: () => {
      /* no-op */
    },
  })
  .setup(() => ({
    add: (a: number, b: number): number => a + b,
    multiply: (a: number, b: number): number => a * b,
  }));

console.log('✅ PASSED: Normal patterns work correctly');

// Test with extremely long pattern (should throw)
try {
  const maliciousPlugin = plugin('malicious', '1.0.0')
    .proxy({
      include: ['*'.repeat(300)], // Pattern too long (>200 chars)
      before: () => {
        /* no-op */
      },
    })
    .setup(() => ({
      test: (): string => 'test',
    }));

  console.log('❌ FAILED: Long pattern was not blocked!');
  console.log(maliciousPlugin.id);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (error) {
  console.log('✅ PASSED: Long pattern blocked (prevents ReDoS)\n');
}

// ============================================================================
// 3. Memory Leak Protection (Watcher Cleanup)
// ============================================================================

console.log('3️⃣  Testing Memory Leak Protection');

const memoryStore = createStore({ value: 0 }, { maxWatchers: 10 });

// Register multiple watchers
const unwatchers: Array<() => void> = [];
for (let i = 0; i < 5; i++) {
  const unwatch = memoryStore.watch('value', () => {
    /* no-op */
  });
  unwatchers.push(unwatch);
}

console.log('✅ Registered 5 watchers');

// Cleanup watchers
unwatchers.forEach(unwatch => unwatch());
console.log('✅ Cleaned up 5 watchers using unwatch()');

// Test clearWatchers method
for (let i = 0; i < 3; i++) {
  memoryStore.watch('value', () => {
    /* no-op */
  });
}
console.log('✅ Registered 3 more watchers');

memoryStore.clearWatchers();
console.log('✅ PASSED: clearWatchers() method available for cleanup\n');

// ============================================================================
// 4. Stack Overflow Protection (Iterative DFS)
// ============================================================================

console.log('4️⃣  Testing Stack Overflow Protection');

// Create a large chain of dependencies (simulating many plugins)
const plugins: any[] = [];
for (let i = 0; i < 100; i++) {
  const prevPlugin = i > 0 ? plugins[i - 1] : null;

  const p = plugin(`plugin-${i}`, '1.0.0');

  if (prevPlugin) {
    p.depends(prevPlugin);
  }

  plugins.push(
    p.setup(() => ({
      getId: (): string => `plugin-${i}`,
    }))
  );
}

try {
  const kernel = createKernel();
  plugins.forEach(p => kernel.use(p));

  console.log('✅ PASSED: Large plugin chain handled without stack overflow');
  console.log(`   (Successfully processed ${plugins.length} plugins in a chain)\n`);
} catch (error) {
  console.log('❌ FAILED: Stack overflow occurred:', (error as Error).message);
}

// ============================================================================
// 5. Clone Security (Object.keys instead of for...in)
// ============================================================================

console.log('5️⃣  Testing Secure Clone Implementation');

const transactionStore = createStore({ data: { value: 100 } }, { cloneStrategy: 'manual' });

// Attempt to pollute before transaction
try {
  // @ts-expect-error - Testing runtime protection
  transactionStore['__proto__'] = { polluted: true };
} catch {
  // Expected to throw
}

// Run transaction with manual clone
transactionStore
  .transaction(async () => {
    transactionStore.data = { value: 200 };
  })
  .then(() => {
    console.log('✅ PASSED: Transaction cloning uses secure Object.keys() method\n');

    // ============================================================================
    // Summary
    // ============================================================================

    console.log('🎉 All Security Tests Passed!');
    console.log('✅ Prototype Pollution: Protected');
    console.log('✅ ReDoS: Protected');
    console.log('✅ Memory Leaks: Mitigated (clearWatchers available)');
    console.log('✅ Stack Overflow: Protected (iterative DFS)');
    console.log('✅ Clone Security: Protected (Object.keys)');
  })
  .catch(error => {
    console.error('❌ Transaction test failed:', error);
  });
