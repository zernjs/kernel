import { createKernel, definePlugin } from '../src';

/**
 * Exemplo 02: Dependências
 *
 * Mostra como um plugin pode depender de outro e acessar sua API.
 * O TypeScript garante que você só acesse plugins declarados.
 */

// 1. Plugin de Logger (Independente)
const loggerPlugin = definePlugin({
  name: 'logger',
  version: '1.0.0',
  setup: () => ({
    log: (msg: string): void => console.log(`[LOG]: ${msg}`),
    error: (msg: string): void => console.error(`[ERR]: ${msg}`),
  }),
});

// 2. Plugin de Banco de Dados (Depende de Logger)
const databasePlugin = definePlugin({
  name: 'database',
  version: '1.0.0',
  dependencies: [loggerPlugin], // Declara dependência explícita
  setup: ctx => {
    // Acesso tipado ao logger
    const logger = ctx.plugins.logger;

    return {
      connect: (): boolean => {
        logger.log('Conectando ao banco de dados...');
        // Simulação de conexão
        logger.log('Conectado com sucesso!');
        return true;
      },
    };
  },
});

async function main(): Promise<void> {
  console.log('--- Iniciando Exemplo de Dependências ---');

  const app = await createKernel().use(loggerPlugin).use(databasePlugin).start();

  // O app tem acesso a ambos
  app.plugins.database.connect();
}

main().catch(console.error);
