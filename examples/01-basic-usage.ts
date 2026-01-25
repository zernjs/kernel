import { createKernel, definePlugin } from '../src';

/**
 * Exemplo 01: Uso Básico
 *
 * Demonstra como criar um plugin simples e inicializar o kernel.
 * O Zern Kernel infere automaticamente os tipos dos seus plugins.
 */

// 1. Definindo um plugin de matemática simples
const mathPlugin = definePlugin({
  name: 'math',
  version: '1.0.0',
  setup: () => {
    // Estado privado do plugin
    let operationCount = 0;

    // Retorna a API Pública
    return {
      add: (a: number, b: number): number => {
        operationCount++;
        return a + b;
      },
      subtract: (a: number, b: number): number => {
        operationCount++;
        return a - b;
      },
      getOperationsCount: (): number => operationCount,
    };
  },
});

// 2. Inicializando o Kernel
async function main(): Promise<void> {
  console.log('--- Iniciando Exemplo Básico ---');

  const app = await createKernel().use(mathPlugin).start();

  // 3. Usando o plugin com type-safety completo
  const sum = app.plugins.math.add(10, 5);
  const sub = app.plugins.math.subtract(10, 5);
  const count = app.plugins.math.getOperationsCount();

  console.log(`10 + 5 = ${sum}`);
  console.log(`10 - 5 = ${sub}`);
  console.log(`Operações realizadas: ${count}`);
}

main().catch(console.error);
