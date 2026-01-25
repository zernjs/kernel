import { createKernel, definePlugin } from '../src';

/**
 * Exemplo 05: Interceptação e Middlewares
 *
 * Demonstra como usar o sistema de middlewares do Zern Kernel para:
 * 1. Executar código antes/depois de um método.
 * 2. Modificar argumentos de entrada.
 * 3. Modificar o valor de retorno.
 * 4. Sobrescrever completamente a implementação.
 */

// 1. Plugin Base: Calculadora
const calculatorPlugin = definePlugin({
  name: 'calculator',
  version: '1.0.0',
  setup: () => ({
    add: (a: number, b: number): number => {
      console.log(`[Calculator] Executing add(${a}, ${b})`);
      return a + b;
    },
    multiply: (a: number, b: number): number => {
      console.log(`[Calculator] Executing multiply(${a}, ${b})`);
      return a * b;
    },
  }),
});

// 2. Plugin de Logger (Interceptação Simples)
// Adiciona logs antes e depois da execução, sem alterar dados.
const loggerInterceptor = definePlugin({
  name: 'logger-interceptor',
  version: '1.0.0',
  dependencies: [calculatorPlugin],
  setup: () => ({
    api: {},
    middlewares: {
      calculator: {
        // Tipagem Inferida Automaticamente! Sem 'any'!
        add: (next, a, b) => {
          console.log(`[Logger] Before add: ${a}, ${b}`);
          const result = next(a, b);
          console.log(`[Logger] After add: Result is ${result}`);
          return result;
        },
      },
    },
  }),
});

// 3. Plugin de Validação (Modificação de Entrada/Cancelamento)
// Verifica argumentos e impede a execução se inválidos.
const validationInterceptor = definePlugin({
  name: 'validator',
  version: '1.0.0',
  dependencies: [calculatorPlugin, loggerInterceptor], // Garante ordem (valida depois de logar)
  setup: () => ({
    api: {},
    middlewares: {
      calculator: {
        add: (next, a, b) => {
          if (a < 0 || b < 0) {
            console.error('[Validator] Negative numbers are not allowed! returning 0');
            return 0; // Sobrescreve e retorna early, 'next' NUNCA é chamado
          }
          return next(a, b);
        },
      },
    },
  }),
});

// 4. Plugin de "Inflação" (Modificação de Saída)
// Altera o resultado final da multiplicação.
const inflationInterceptor = definePlugin({
  name: 'inflation',
  version: '1.0.0',
  dependencies: [calculatorPlugin],
  setup: () => ({
    api: {},
    middlewares: {
      calculator: {
        multiply: (next, a, b) => {
          const originalResult = next(a, b);
          const inflated = originalResult * 1.1; // Adiciona 10%
          console.log(`[Inflation] Original: ${originalResult}, Inflated: ${inflated}`);
          return inflated;
        },
      },
    },
  }),
});

// 5. Plugin "Hacker" (Modificação de Entrada)
// Força argumentos diferentes para a soma.
const hackerInterceptor = definePlugin({
  name: 'hacker',
  version: '1.0.0',
  dependencies: [calculatorPlugin, validationInterceptor], // Roda por último na cadeia de add
  setup: () => ({
    api: {},
    middlewares: {
      calculator: {
        // Ao usar nomes que começam com _, o TypeScript/ESLint entende que podem ser não utilizados,
        // mas a inferência ainda deve funcionar se o contexto estiver correto.
        add: next => {
          console.log('[Hacker] I am changing your inputs to 100 and 100!');
          return next(100, 100);
        },
      },
    },
  }),
});

async function main(): Promise<void> {
  console.log('--- Iniciando Exemplo de Middlewares ---');

  const app = await createKernel()
    .use(calculatorPlugin)
    .use(loggerInterceptor)
    .use(validationInterceptor)
    .use(inflationInterceptor)
    .use(hackerInterceptor)
    .start();

  console.log('\n--- Teste 1: Soma Normal (Interceptada pelo Logger e Hacker) ---');
  // Hacker muda 10+5 para 100+100 = 200
  // Logger vê a entrada original (10, 5) porque roda ANTES do Hacker na cadeia (dependência)
  // Validator vê 100, 100
  const sum = app.plugins.calculator.add(10, 5);
  console.log(`Resultado Final da Soma: ${sum}`);

  console.log('\n--- Teste 2: Validação (Números Negativos) ---');
  // Hacker muda para 100, 100, então a validação passa!
  // Vamos pular o hacker para testar validação real?
  // Não, vamos apenas observar. O Hacker "corrigiu" a entrada inválida.
  const sum2 = app.plugins.calculator.add(-5, -10);
  console.log(`Resultado Final da Soma (-5, -10): ${sum2}`);

  console.log('\n--- Teste 3: Multiplicação (Inflação) ---');
  const mult = app.plugins.calculator.multiply(100, 2); // Esperado 200 -> 220
  console.log(`Resultado Final da Multiplicação: ${mult}`);
}

main().catch(console.error);
