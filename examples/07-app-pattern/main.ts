import { k } from './kernel';

/**
 * Exemplo 07: Padrão de Instância da Aplicação (App Instance Pattern)
 *
 * Em vez de tentar injetar tipos globais na biblioteca (o que exige configuração manual complexa),
 * o padrão moderno e type-safe é criar e exportar a instância do kernel de um arquivo
 * da própria aplicação (ex: './kernel.ts').
 *
 * Vantagens:
 * 1. Zero configuração de tipos manuais (declare module, interfaces, etc).
 * 2. Inferência automática 100% precisa.
 * 3. Funciona com múltiplos kernels se necessário.
 * 4. Padrão de mercado (usado por Prisma, Firebase, etc).
 */

function main(): void {
  console.log('--- App Instance Pattern Demo (Sync) ---');

  k.plugins.logger.info('Hello from consumer module!');

  const result = k.plugins.calculator.add(50, 50);
  console.log('Result:', result);
}

main();
