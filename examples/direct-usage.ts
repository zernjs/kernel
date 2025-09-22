import {
  add,
  subtract,
  multiply,
  divide,
  power,
  sqrt,
  factorial,
  isEven,
  isOdd,
  round,
  configure,
  getHistory,
  mathPlugin,
} from './math-plugin/src';

import { createKernel } from '../src';
await createKernel().use(mathPlugin).start();

console.log(add(1, 2));
console.log(subtract(1, 2));
console.log(multiply(1, 2));
console.log(divide(1, 2));
console.log(power(1, 2));
console.log(sqrt(1));
console.log(factorial(1));
console.log(isEven(1));
console.log(isOdd(1));
console.log(round(1));
console.log(configure({}));
console.log(getHistory());
