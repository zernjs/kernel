/* eslint-disable @typescript-eslint/no-explicit-any */

import { createKernel, definePlugin } from '../src';

/**
 * Exemplo 04: Aplicação "Real World"
 *
 * Simula uma arquitetura de backend completa com camadas:
 * Config -> Logger -> Database -> Users -> API
 *
 * Demonstra:
 * - Ciclo de vida (async setup)
 * - Injeção de dependência profunda
 * - Augmentation em múltiplos níveis
 */

// --- 1. Config Plugin ---
const configPlugin = definePlugin({
  name: 'config',
  version: '1.0.0',
  setup: () => ({
    dbUrl: 'postgres://localhost:5432/mydb',
    logLevel: 'debug',
    port: 3000,
  }),
});

// --- 2. Logger Plugin ---
const loggerPlugin = definePlugin({
  name: 'logger',
  version: '1.0.0',
  dependencies: [configPlugin],
  setup: ctx => {
    // Cast explícito ou type guard seria ideal, mas para o exemplo vamos confiar na estrutura
    // O problema é que ctx.plugins.config é uma união de tipos da API
    const config = ctx.plugins.config;
    const level = config.logLevel;

    return {
      info: (msg: string): void => console.log(`[INFO][${level}] ${msg}`),
      warn: (msg: string): void => console.warn(`[WARN][${level}] ${msg}`),
    };
  },
});

// --- 3. Database Plugin (Async Setup) ---
const dbPlugin = definePlugin({
  name: 'db',
  version: '1.0.0',
  dependencies: [configPlugin, loggerPlugin],
  setup: async ctx => {
    // Cast para ajudar o TS a desambiguar as APIs no contexto
    const logger = ctx.plugins.logger;
    const config = ctx.plugins.config;

    logger.info(`Conectando ao DB em ${config.dbUrl}...`);

    // Simula delay de conexão
    await new Promise(resolve => setTimeout(resolve, 500));

    logger.info('DB Conectado!');

    const storage = new Map<string, any>();

    return {
      save: (table: string, data: any): void => {
        storage.set(`${table}:${data.id}`, data);
        logger.info(`Salvo em ${table}: ${data.id}`);
      },
      find: (table: string, id: string): any => {
        return storage.get(`${table}:${id}`);
      },
    };
  },
});

// --- 4. Users Plugin (Business Logic) ---
const usersPlugin = definePlugin({
  name: 'users',
  version: '1.0.0',
  dependencies: [dbPlugin],
  setup: ctx => {
    return {
      create: (user: { id: string; name: string }): void => {
        ctx.plugins.db.save('users', user);
      },
      get: (id: string): any => {
        return ctx.plugins.db.find('users', id);
      },
    };
  },
});

// --- 5. Audit Plugin (Cross-Cutting Concern via Augmentation) ---
// Este plugin "hackeia" o método save do DB para adicionar auditoria automaticamente
const auditPlugin = definePlugin({
  name: 'audit',
  version: '1.0.0',
  dependencies: [dbPlugin, loggerPlugin],
  setup: ctx => {
    // Aqui não substituímos a implementação original (ainda não suportado por padrão neste exemplo simples),
    // mas adicionamos um método auxiliar que os devs podem usar.
    // *Nota: Em versões futuras, poderíamos suportar wrapping de métodos existentes via middleware.*

    const logger = ctx.plugins.logger;
    const db = ctx.plugins.db;

    return {
      api: {}, // Sem API própria
      extensions: {
        db: {
          saveWithAudit: (table: string, data: any, user: string): void => {
            logger.info(`AUDIT: User ${user} is saving to ${table}`);
            db.save(table, data);
          },
        },
      },
    };
  },
});

// --- Main App ---
async function main(): Promise<void> {
  console.log('--- Iniciando App Real World ---');

  const app = await createKernel()
    .use(configPlugin)
    .use(loggerPlugin)
    .use(dbPlugin)
    .use(usersPlugin)
    .use(auditPlugin)
    .start();

  console.log('\n--- Runtime ---');

  // Uso normal
  app.plugins.users.create({ id: 'u1', name: 'Vini' });

  // Uso com augmentation de auditoria
  app.plugins.db.saveWithAudit('posts', { id: 'p1', title: 'Hello' }, 'u1');

  const user = app.plugins.users.get('u1');
  console.log('User recuperado:', user);
}

main().catch(console.error);
