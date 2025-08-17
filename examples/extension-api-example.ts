/**
 * @file Exemplo simples demonstrando a Extension API do Zern Kernel.
 * Mostra como estender plugins de forma básica e direta.
 */

import { plugin, ZernKernel } from '../src/index.js';

// Plugin base que fornece operações matemáticas simples
const mathPlugin = plugin('math')
  .version('1.0.0')
  .setup(() => {
    return {
      add: (a: number, b: number): number => a + b,
      multiply: (a: number, b: number): number => a * b,
    };
  })
  .build();

// Plugin que estende o math com novas operações
const extendedMathPlugin = plugin('extended-math')
  .version('1.0.0')
  .depends(mathPlugin, '1.0.0')
  .extend(mathPlugin, _api => {
    return {
      square: (n: number): number => n * n,
      cube: (n: number): number => n * n * n,
    };
  })
  .setup(() => ({}))
  .build();

// Exemplo de uso
async function simpleExample(): Promise<void> {
  console.log('=== Exemplo Simples da Extension API ===\n');

  // Cria o kernel e registra os plugins
  const kernel = ZernKernel().plugin(mathPlugin).plugin(extendedMathPlugin).build();

  await kernel.initialize();

  // Obtém a API estendida com tipos corretos automaticamente
  const math = kernel.plugins.get('math');

  if (math) {
    console.log('Operações básicas:');
    console.log(`2 + 3 = ${math.add(2, 3)}`);
    console.log(`4 * 5 = ${math.multiply(4, 5)}`);

    console.log('\nOperações estendidas:');
    console.log(`5² = ${math.square(5)}`);
    console.log(`3³ = ${math.cube(3)}`);
  }

  await kernel.destroy();
  console.log('\n=== Exemplo Concluído ===');
}

// Executa o exemplo
simpleExample().catch(console.error);

export { mathPlugin, extendedMathPlugin, simpleExample };
