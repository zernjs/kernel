import { definePlugin, createKernel } from '../src';

/**
 * Exemplo 08: Versionamento Semântico e Validação
 *
 * Demonstra como:
 * 1. Definir versões para plugins.
 * 2. Declarar dependências com faixas de versão (Ranges).
 * 3. O Kernel valida as versões na inicialização.
 */

// 1. Plugin Base (Versão 1.0.0)
const corePlugin = definePlugin({
  name: 'core',
  version: '1.0.0',
  setup: () => ({
    version: '1.0.0',
    hello: () => 'world',
  }),
});

// 2. Plugin Base (Versão 2.0.0 - Breaking Change)
// Em um cenário real, isso estaria em outro arquivo/pacote.
const corePluginV2 = definePlugin({
  name: 'core',
  version: '2.0.0',
  setup: () => ({
    version: '2.0.0',
    hello: () => 'BRAVE NEW WORLD',
  }),
});

// 3. Plugin Legado (Depende de Core ^1.0.0)
const legacyPlugin = definePlugin({
  name: 'legacy',
  version: '1.0.0',
  dependencies: [
    { plugin: corePlugin, range: '^1.0.0' }, // Aceita >=1.0.0 <2.0.0
  ],
  setup: ctx => ({
    run: () => {
      console.log(`Legacy running with Core v${ctx.plugins.core.version}`);
    },
  }),
});

// 4. Plugin Moderno (Depende de Core >=2.0.0)
const modernPlugin = definePlugin({
  name: 'modern',
  version: '1.0.0',
  dependencies: [{ plugin: corePluginV2, range: '>=2.0.0' }],
  setup: ctx => ({
    run: () => {
      console.log(`Modern running with Core v${ctx.plugins.core.version}`);
    },
  }),
});

async function main(): Promise<void> {
  console.log('--- Teste de Versionamento ---');

  // CASO 1: Sucesso (Core v1 satisfaz Legacy ^1.0.0)
  try {
    console.log('\n[1] Tentando Core v1 + Legacy...');
    const app1 = await createKernel().use(corePlugin).use(legacyPlugin).start();
    app1.plugins.legacy.run();
    console.log('✅ Sucesso!');
  } catch (e: any) {
    console.error('❌ Falha:', e.message);
  }

  // CASO 2: Falha (Core v2 NÃO satisfaz Legacy ^1.0.0)
  try {
    console.log('\n[2] Tentando Core v2 + Legacy (Deve falhar)...');
    await createKernel()
      .use(corePluginV2) // v2.0.0
      .use(legacyPlugin) // Requer ^1.0.0
      .start();
  } catch (e: any) {
    console.log('✅ Erro Capturado (Esperado):', e.message);
  }

  // CASO 3: Sucesso (Core v2 satisfaz Modern >=2.0.0)
  try {
    console.log('\n[3] Tentando Core v2 + Modern...');
    const app3 = await createKernel().use(corePluginV2).use(modernPlugin).start();
    app3.plugins.modern.run();
    console.log('✅ Sucesso!');
  } catch (e: any) {
    console.error('❌ Falha:', e.message);
  }
}

main().catch(console.error);
