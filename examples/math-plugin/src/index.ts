export {
  add,
  configure,
  divide,
  factorial,
  getHistory,
  isEven,
  isOdd,
  multiply,
  power,
  round,
  sqrt,
  subtract,
} from './direct-api';

// Para uso com o kernel (createKernel().use(mathPlugin))
export { mathPlugin } from './plugin';

// Para tipagens
export type { MathAPI } from './interfaces';
