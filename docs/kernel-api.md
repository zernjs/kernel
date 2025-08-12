## Zern Kernel — Core API (sem events/hooks/alerts)

Este guia descreve a API pública do Kernel focada apenas no núcleo: criação, registro e ordenação de plugins, ciclo de vida, erros, augmentations e helpers utilitários. As camadas de events, hooks e alerts foram propositalmente omitidas.

### Sumário

- Kernel e Builder
- Registro e ordem de carregamento de plugins
- Ciclo de vida (lifecycle)
- Erros (ErrorBus e erros do Kernel)
- Augmentations (extensão de APIs)
- Resolver (ordenação por dependências e regras do usuário)
- Helpers globais do Kernel
- Tipos úteis

---

## Kernel e Builder

O Kernel é o orquestrador de plugins. Você o cria via `createKernel()` e registra plugins através do `KernelBuilder`.

```ts
import { createKernel } from '@core/createKernel';
import { definePlugin } from '@plugin/definePlugin';

const MyPlugin = definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  async setup(ctx) {
    // API pública exposta pelo plugin (será anexada à instância do plugin)
    return {
      ping(): string {
        return 'pong';
      },
      // Fases de lifecycle podem ser expostas pela API (ver seção Lifecycle)
      async init() {
        // ...
      },
    };
  },
});

const kernel = createKernel().use(MyPlugin).build();

await kernel.init();

// Acesso tipado ao plugin pelo nome
const api = kernel.plugins['my-plugin'];
api.ping();
```

### KernelBuilder

- `use(pluginCtor, order?)`: registra um plugin. Aceita `order.before/after` para preferências do usuário.
- `withOptions(options)`: configura opções do Kernel (ex.: políticas de augmentation).
- `build()`: instancia o `Kernel` com os plugins registrados.

### Kernel (instância)

- `plugins`: accessor tipado para instâncias de plugins registrados.
  - Métodos utilitários: `register`, `has`, `list`, `getLoadOrder`, `clear`.
- `init()`: resolve ordem de plugins, executa setup/augmentations e roda fases de lifecycle iniciais.
- `destroy()`: executa fases de teardown e limpa o registro.
- `loadedPlugins`: nomes dos plugins carregados (somente leitura).
- `lifecycleEvents`: emissor de eventos de ciclo de vida do Kernel.

Exemplo de uso dos eventos de lifecycle do Kernel:

```ts
kernel.lifecycleEvents.on('pluginLoaded', ({ name }) => {
  console.log('Carregado:', name);
});

kernel.lifecycleEvents.on('pluginFailed', ({ name, error }) => {
  console.error('Falhou:', name, error);
});
```

---

## Registro e ordem de carregamento de plugins

O Kernel calcula a ordem final combinando:

- Dependências explícitas entre plugins (`dependsOn`),
- Preferências do usuário (`use(plugin, { before, after })`),
- Dicas opcionais no metadado do plugin (`loadBefore`, `loadAfter`).

Dependências são declaradas no `definePlugin` via `dependsOn`:

```ts
const A = definePlugin({
  name: 'A',
  version: '1.0.0',
  async setup() {
    return {};
  },
});
const B = definePlugin({
  name: 'B',
  version: '1.0.0',
  dependsOn: [A],
  async setup() {
    return {};
  },
});

const kernel = createKernel()
  .use(A)
  .use(B, { after: ['A'] })
  .build();
await kernel.init();
```

> Em caso de inconsistência (ciclos, versões inválidas), o Kernel lança erros estruturados (ver seção Erros).

---

## Ciclo de vida (lifecycle)

O Kernel executa fases padronizadas nos plugins: `beforeInit`, `init`, `afterInit`, `beforeDestroy`, `destroy`, `afterDestroy`.

Fases podem ser expostas pelo próprio plugin através da API retornada pelo `setup` (que é mesclada na instância do plugin) ou por métodos no próprio plugin.

```ts
const P = definePlugin({
  name: 'lifecycle-demo',
  version: '1.0.0',
  async setup(ctx) {
    return {
      async init() {
        // Executado na fase 'init'
      },
      async destroy() {
        // Executado na fase 'destroy'
      },
    };
  },
});
```

Configurações avançadas (concorrência e políticas por fase) são internas ao Kernel; plugins apenas implementam as fases quando necessário.

---

## Erros (ErrorBus e erros do Kernel)

> IMPORTANTE: Esta seção descreve a API LEGADA/ATUAL e será substituída pela nova API proposta abaixo. Use-a como referência até a migração para `report`/`fail`/`once`.

O Kernel expõe um `ErrorBus` para roteamento de erros tipados entre consumidores interessados.

### Definindo erros tipados

```ts
import { defineErrors, bindErrors, ErrorBus } from '@errors';

const AuthErrors = defineErrors('auth', {
  InvalidCredentials: (p: { user: string }) => p,
  LockedAccount: (p: { user: string }) => p,
});

const bus = new ErrorBus();
const auth = bindErrors(bus, AuthErrors);

// Escuta
const off = auth.on('InvalidCredentials', (payload, meta) => {
  console.warn('invalid', payload, meta);
});

// Publica sem lançar
await auth.throw('InvalidCredentials', { user: 'u1' }, { source: 'custom' });

// Publica e lança (interrompe fluxo com ReportedError)
await auth.raise('LockedAccount', { user: 'u1' });

off();
```

### Erros estruturados do Kernel

O Kernel lança `KernelError` para condições conhecidas:

- `DependencyMissing`, `DependencyVersionUnsatisfied`, `DependencyCycle`
- `LifecyclePhaseFailed`
- `InvalidVersionSpec`
- `AugmentationConflict`

Você pode detectar com o guard `isKernelError(err)`.

---

## Augmentations (extensão de APIs)

Plugins podem estender APIs de outros plugins de forma segura. O Kernel mescla as APIs expostas no `setup` e aplica políticas de conflito.

Políticas de conflito (`AugmentationOptions.policy`):

- `error`: lança erro em conflitos;
- `override`: sobrescreve a chave existente;
- `namespace`: mantém ambas as versões, prefixando a nova (`namespacePrefix`).

Exemplo de extensão:

```ts
const Utils = definePlugin({
  name: 'utils',
  version: '1.0.0',
  async setup() {
    return {
      formatDate(d: Date) {
        return d.toISOString();
      },
    };
  },
});

const App = definePlugin({
  name: 'app',
  version: '1.0.0',
  dependsOn: [Utils],
  async setup(ctx) {
    // expõe API própria
    return {
      async init() {
        const iso = ctx.plugins.utils.formatDate(new Date());
        console.log('init @', iso);
      },
    };
  },
});
```

> O Kernel fornece internamente o mecanismo de merge e aplica freeze em folhas de objetos para segurança.

---

## Nova API de Errors (proposta)

Esta seção apresenta a API simplificada de erros que substitui o uso direto de `Throw`/`Raise` e `bindErrors`.

### Objetivos

- **Consumo simples**: importar apenas `report`, `fail`, `once`.
- **Autocomplete e payloads tipados**: sem `declare module` e sem bindings manuais.

### Uso no aplicativo

```ts
import { report, fail, once } from '@zern/kernel';

await report('auth.InvalidCredentials', { user: 'u1' });
await fail('auth.LockedAccount', { user: 'u2' }, { cause: new Error('locked') });

const payload = await once('auth.InvalidCredentials');
// payload: { user: string }
```

### Como plugins expõem erros tipados (sem `declare module`)

Os plugins declaram erros com `defineErrors` e atribuem o resultado diretamente ao campo `errors` do `definePlugin`. O Kernel acumula esses tipos em seu mapa interno, habilitando autocomplete nas chaves `namespace.kind` para `report`/`fail`/`once`.

```ts
import { definePlugin } from '@plugin/definePlugin';
import { defineErrors } from '@errors';

const AuthErrors = defineErrors('auth', {
  InvalidCredentials: (p: { user: string }) => p,
  LockedAccount: (p: { user: string }) => p,
});

export const Auth = definePlugin({
  name: 'auth',
  version: '1.0.0',
  errors: AuthErrors, // Tipos e chaves são conhecidos pelo Kernel
  async setup() {
    return {};
  },
});
```

### Notas de compatibilidade

- `report` equivale ao legado `Throw` (não lança); `fail` equivale a `Raise` (lança `ReportedError`).
- Durante a migração, `Throw`/`Raise` podem permanecer como aliases internos.
- A API proposta não requer `bindErrors` nem arquivos de augment (`.d.ts`).

### Migração rápida (do legado para a nova API)

1. Em plugins, troque `errors: { namespace, kinds }` por `errors: defineErrors(namespace, spec)`.
2. No app, substitua `bindErrors(bus, Errors)` e chamadas diretas ao `ErrorBus` por `report`/`fail`/`once`.
3. Remova usos manuais de `Throw`/`Raise` no código de consumo.

---

## Resolver (ordenação por dependências e regras do usuário)

O Kernel utiliza um grafo de restrições com arestas do tipo:

- `dep`: dependência declarada (maior peso),
- `user`: preferências do usuário (`before/after`),
- `hint`: dicas opcionais (`loadBefore/loadAfter`).

A ordenação final é obtida por sort topológico estável. Em caso de ciclo, um `KernelError('DependencyCycle')` é lançado.

> Dica: para dependências opcionais, use a forma detalhada em `dependsOn` (com `optional: true`) no plugin.

---

## Helpers globais do Kernel

Para facilitar a inicialização e reuso de uma instância global do Kernel no processo:

```ts
import { getKernel, ensureKernel, withKernel } from '@zern/kernel';

// obtém o builder global (preguiçoso)
const builder = getKernel();

// garante uma instância inicializada
const kernel = await ensureKernel();

// projeta um valor da instância inicializada
const value = await withKernel(k => k.loadedPlugins);
```

> Estes helpers não expõem events/hooks/alerts; focam apenas em facilitar o acesso ao Kernel.

---

## Tipos úteis (visão geral)

- `PluginInstance`, `PluginCtor`, `PluginSpec`: contrato dos plugins.
- `UseOrder`: preferências `before/after` ao registrar plugins.
- `LifecyclePhase`: nomes das fases de ciclo de vida.
- `KernelError`, `isKernelError`: erros estruturados do Kernel.
- `ErrorBus`, `defineErrors`, `bindErrors`, `ReportedError`.

---

## Boas práticas

- Mantenha plugins pequenos e com `setup` idempotente.
- Prefira declarar dependências via `dependsOn` a depender de ordem manual.
- Use fases de lifecycle apenas quando necessário; prefira inicialização no `setup`.
- Registre e trate erros via `ErrorBus` para observabilidade consistente.
