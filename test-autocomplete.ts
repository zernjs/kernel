import { createKernel, plugin } from './dist/index.js';

// Criar plugins de teste
const mathPlugin = plugin('math', '1.0.0').setup(() => ({
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
}));

const loggerPlugin = plugin('logger', '1.0.0').setup(() => ({
  log: (message: string) => console.log(`[LOG] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
}));

async function testAutoComplete() {
  const kernel = await createKernel().use(mathPlugin).use(loggerPlugin).build().init();

  // Teste de autocompletar - deve mostrar métodos específicos
  const math = kernel.get('math'); // Deve mostrar: add, multiply
  const logger = kernel.get('logger'); // Deve mostrar: log, error

  // Teste de uso
  console.log('Math add:', math.add(2, 3));
  logger.log('Test completed');
}

testAutoComplete().catch(console.error);
