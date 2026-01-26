import { createKernel, definePlugin } from '../src';

/**
 * Exemplo 09: Custom Hooks (Ganchos Personalizados)
 *
 * Demonstra como plugins podem definir e emitir seus próprios eventos (hooks),
 * e como outros plugins podem reagir a esses eventos.
 */

// 1. Definindo um plugin 'Database' que emite eventos
const databasePlugin = definePlugin({
  name: 'database',
  version: '1.0.0',
  // Definimos a tipagem dos eventos que este plugin fornece
  events: {} as {
    onRecordCreated: (table: string, id: string, data: any) => void;
    onRecordDeleted: (table: string, id: string) => void;
  },
  setup: ctx => {
    const db = new Map<string, any>();

    return {
      insert: (table: string, id: string, data: any) => {
        db.set(`${table}:${id}`, data);
        console.log(`[Database] Inserindo registro ${id} na tabela ${table}`);

        // Emitindo o hook síncrono
        // Note: ctx.hooks aqui inclui os hooks do Kernel e os definidos em 'events'
        // Agora podemos usar .emit() (alias para emitSync) ou .emitSync()
        ctx.hooks.emit('onRecordCreated', table, id, data);
        return true;
      },
      delete: (table: string, id: string) => {
        const key = `${table}:${id}`;
        if (db.has(key)) {
          db.delete(key);
          console.log(`[Database] Removendo registro ${id} da tabela ${table}`);
          ctx.hooks.emit('onRecordDeleted', table, id);
          return true;
        }
        return false;
      },
    };
  },
});

// 2. Definindo um plugin 'AuditLogger' que escuta eventos do Database
const auditPlugin = definePlugin({
  name: 'audit',
  version: '1.0.0',
  // Declaramos dependência explícita do databasePlugin
  dependencies: [databasePlugin],
  setup: ctx => {
    // Graças à dependência, ctx.hooks agora inclui 'onRecordCreated' e 'onRecordDeleted'
    // com type-safety completo nos argumentos!

    ctx.hooks.on('onRecordCreated', (table, id, data) => {
      console.log(`[Audit] NOVO REGISTRO DETECTADO: Tabela=${table}, ID=${id}`);
      console.log(`[Audit] Dados:`, data);
    });

    ctx.hooks.on('onRecordDeleted', (table, id) => {
      console.log(`[Audit] REGISTRO REMOVIDO: Tabela=${table}, ID=${id}`);
    });

    return {
      getAuditLogs: () => 'Simulação de logs de auditoria...',
    };
  },
});

// 3. Inicializando o Kernel
async function main(): Promise<void> {
  console.log('--- Iniciando Exemplo de Custom Hooks ---');

  const app = await createKernel().use(databasePlugin).use(auditPlugin).start();

  console.log('\n--- Executando Operações ---');

  // Ao chamar insert, o databasePlugin emitirá o evento, e o auditPlugin irá logar
  app.plugins.database.insert('users', 'u1', { name: 'Vini', role: 'admin' });

  console.log('\n---');

  app.plugins.database.insert('products', 'p1', { title: 'Teclado Mecânico', price: 150 });

  console.log('\n---');

  app.plugins.database.delete('users', 'u1');
}

main().catch(console.error);
