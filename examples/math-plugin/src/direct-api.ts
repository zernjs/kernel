import { createDirectMethod } from '../../../src';
import type { MathAPI } from '../src/interfaces';

// Métodos exportáveis diretamente - resolvem kernel automaticamente
export const add: MathAPI['add'] = createDirectMethod('math', 'add');
export const subtract: MathAPI['subtract'] = createDirectMethod('math', 'subtract');
export const multiply: MathAPI['multiply'] = createDirectMethod('math', 'multiply');
export const divide: MathAPI['divide'] = createDirectMethod('math', 'divide');
export const power: MathAPI['power'] = createDirectMethod('math', 'power');
export const sqrt: MathAPI['sqrt'] = createDirectMethod('math', 'sqrt');
export const factorial: MathAPI['factorial'] = createDirectMethod('math', 'factorial');
export const isEven: MathAPI['isEven'] = createDirectMethod('math', 'isEven');
export const isOdd: MathAPI['isOdd'] = createDirectMethod('math', 'isOdd');
export const round: MathAPI['round'] = createDirectMethod('math', 'round');

// Métodos especiais que precisam de tratamento diferente
export const configure: MathAPI['configure'] = createDirectMethod('math', 'configure');
export const getHistory: MathAPI['getHistory'] = createDirectMethod('math', 'getHistory');
