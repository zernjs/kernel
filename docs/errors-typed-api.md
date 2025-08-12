## API de Erros Tipada do Kernel — Guia de Implementação e Uso

Este guia documenta a API de erros tipada do Kernel, como os tipos fluem dos plugins até os helpers e como aplicar o mesmo padrão em novas features (p. ex., eventos futuros). O objetivo é ter autocomplete de chaves `'namespace.kind'`, payloads inferidos, sem `declare module` e sem arquivos `.d.ts`.

---

### Objetivos

- **Autocomplete nas chaves** `'ns.kind'`.
- **Payloads tipados** e inferidos automaticamente.
- **Sem module augmentation** ou `.d.ts`.
- **DX consistente** via helpers globais e helpers vinculados a um `Kernel` concreto.

---

## Visão Geral

- **Plugins** declaram erros com `defineErrors('ns', spec)` e os expõem no `definePlugin({ errors })`.
- O **Builder/Kernel** acumula um mapa global de erros (por generics) com base nos plugins usados.
- **Helpers**:
  - Globais (`report`, `fail`, `once`, `on`): usam o Kernel global (lazy via `ensureKernel`), com fallback seguro de tipos quando o mapa global não é inferível.
  - Vinculados (`createErrorHelpers(kernel)`): preferíveis para DX; fornecem autocomplete e inferência precisa (sem `never`) ao serem usadas com `const { on, report, once, fail } = ...`.

---

## Declarando erros no plugin

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
  errors: AuthErrors, // Tipos conhecidos pelo Kernel
  async setup() {
    return {};
  },
});
```

- A propriedade `errors` aceita o retorno de `defineErrors(namespace, spec)`.
- O Kernel acumula isso no mapa global (tipo `M`) usado pelos helpers.

---

## Usando no aplicativo

### 1) Helpers vinculados (recomendado para melhor DX)

```ts
import { createKernel } from '@core/createKernel';
import { createErrorHelpers } from '@zern/kernel';

const kernel = createKernel().use(Auth).build();
await kernel.init();

const { on, report, once, fail } = createErrorHelpers(kernel);

// Autocomplete em 'auth.InvalidCredentials' e payload inferido { user: string }
const offInvalid = await on('auth.InvalidCredentials', payload => {
  console.warn('InvalidCredentials:', payload.user);
});

await report('auth.InvalidCredentials', { user: 'u1' });

const p = await once('auth.InvalidCredentials');
// p: { user: string }

try {
  await fail('auth.LockedAccount', { user: 'u2' });
} catch (e) {
  // e: ReportedError<{ user: string }>
}

offInvalid();
```

Por que funciona:

- As funções retornadas por `createErrorHelpers(kernel)` são **funções genéricas** (e não “uniões de assinaturas”), preservando a correlação entre `key` e `payload`. Isso evita o colapso para `never` quando você destrutura `{ on, report, once, fail }`.

Assinaturas (forma simplificada):

```ts
function createErrorHelpers<P, A, M>(kernel: Kernel<P, A, M>) {
  return {
    report<K extends JoinNsKind<M>>(key: K, payload: PayloadOfErrorKey<M, K>, meta?): Promise<void>;
    fail<K extends JoinNsKind<M>>(key: K, payload: PayloadOfErrorKey<M, K>, meta?): Promise<never>;
    once<K extends JoinNsKind<M>>(key: K): Promise<PayloadOfErrorKey<M, K>>;
    on<K extends JoinNsKind<M>>(key: K, handler: (p: PayloadOfErrorKey<M, K>, meta?) => void | Promise<void>): Promise<() => void>;
  };
}
```

### 2) Helpers globais

```ts
import { report, fail, once, on } from '@zern/kernel';

await report('auth.InvalidCredentials', { user: 'u1' });
await fail('auth.LockedAccount', { user: 'u2' });

const payload = await once('auth.InvalidCredentials');
// payload: { user: string } quando o mapa global é inferível
```

Os helpers globais inferem o mapa pelo tipo do Kernel global. Caso o mapa não seja inferível (dependendo do ponto de import), a chave cai no fallback `${string}.${string}` e o payload em `unknown`. Para melhor DX e inferência consistente, prefira os helpers vinculados.

---

## Como os tipos fluem

- `definePlugin({ errors: defineErrors(...) })` injeta informação de tipos no construtor do plugin.
- O `KernelBuilder.use(...)` acumula isso via um utilitário de tipos (ex.: `ExtractErrors<InstanceType<Ctor>>`) e carrega o mapa acumulado no tipo do `Kernel` como `M`.
- `createErrorHelpers(kernel)` recebe `Kernel<..., M>` e tipa as funções retornadas em cima de:
  - `JoinNsKind<M>`: união de chaves `'ns.kind'`.
  - `PayloadOfErrorKey<M, K>`: payload inferido para a chave `K`.
- Helpers globais usam a mesma mecânica, porém inferindo `M` a partir do Kernel global (com fallback seguro).

---

## Evitando payload `never` (pitfall comum)

- Não use “uniões de assinaturas” para indexar cada chave `'ns.kind'` separadamente. Ao destruturar (`const { report } = ...`), o TypeScript perde a correlação e pode “colapsar” para `never`.
- Em vez disso, escreva **funções genéricas por chamada**:
  - `function report<K extends JoinNsKind<M>>(key: K, payload: PayloadOfErrorKey<M, K>) { ... }`
- Garantir fallback correto no extrator de tipos:
  - Prefira `Record<never, never>` como fallback em utilitários do tipo `ExtractErrors<T>` para não “poluir” a união.

---

## Aplicando o padrão em novas features

Para construir APIs tipadas semelhantes (ex.: futuros eventos ou hooks):

1. Modele um “mapa de domínio” `M`:
   - `M = Record<Namespace, Record<Kind, Marker<Payload>>>`.
2. Forneça utilitários de tipos:
   - `JoinNsKind<M>` → `'ns.kind'`.
   - `PayloadOf...<M, K>` → payload compatível com a chave `K`.
3. Propague `M` via generics no `Builder`/`Kernel`.
4. Exponha dois conjuntos de helpers:
   - Globais (podem ter fallback).
   - Vinculados a um `Kernel` concreto (preferidos para DX).
5. Declare os helpers como **funções genéricas** por chamada, não como união de assinaturas.

Esqueleto:

```ts
type Marker<P> = { __type: 'marker'; __payload?: P };

type JoinNsKind<M> = {
  [N in keyof M & string]: {
    [K in keyof M[N] & string]: `${N}.${K}`;
  }[keyof M[N] & string];
}[keyof M & string];

type PayloadOf<M, K extends string> = M[NsOf<K> & keyof M & string][KindOf<K> &
  keyof M[NsOf<K> & keyof M & string] &
  string] extends { __payload?: infer P }
  ? P
  : unknown;

function createFeatureHelpers<M>(/* ... */) {
  return {
    do<K extends JoinNsKind<M>>(key: K, payload: PayloadOf<M, K>) {
      /* ... */
    },
    on<K extends JoinNsKind<M>>(key: K, handler: (p: PayloadOf<M, K>) => void) {
      /* ... */
    },
  };
}
```

---

## Dicas e Troubleshooting

- **Payload virou `never` após destruturar helpers**:
  - Use helpers como funções genéricas (vide acima).
- **Chaves `'ns.kind'` sem autocomplete nos helpers globais**:
  - Use os helpers vinculados (`createErrorHelpers(kernel)`).
  - Verifique se os plugins com `errors` estão realmente “conhecidos” no ponto onde os helpers são usados.
- **Tipos não propagam do plugin**:
  - Confirme que o plugin inclui `errors: defineErrors(...)`.
  - Evite retornar `Record<string, never>` em fallbacks de extratores (prefira `Record<never, never>`).
- **tsconfig**:
  - Garanta que `src` e `examples` estão incluídos para análise, e que `paths` estão corretos para os aliases.

---

## API de Referência (resumo)

- `defineErrors(namespace, spec) → { spec, factories }`
- `definePlugin({ name, version, errors, setup }) → PluginCtor`
- `createKernel().use(Plugin).build() → Kernel`
- `createErrorHelpers(kernel)`:
  - `report<K extends JoinNsKind<M>>(key: K, payload: PayloadOfErrorKey<M, K>, meta?)`
  - `fail<K extends JoinNsKind<M>>(key: K, payload: PayloadOfErrorKey<M, K>, meta?)`
  - `once<K extends JoinNsKind<M>>(key: K) → Promise<PayloadOfErrorKey<M, K>>`
  - `on<K extends JoinNsKind<M>>(key: K, handler) → Promise<() => void>`
- Helpers globais (`report`, `fail`, `once`, `on`): mesma semântica; inferência depende do Kernel global.

---

## Migração rápida (legado → nova API)

1. Em plugins, substitua erros por:
   - `errors: defineErrors('ns', { Kind: (p) => p, ... })`.
2. No app, use:
   - Helpers vinculados do Kernel local para melhor DX.
   - Ou helpers globais como atalho.
3. Remova bindings manuais da camada de erros e aliases legados.

---

## Testes e Qualidade

- Escreva testes que validem:
  - Autocomplete e tipos nas chaves `'ns.kind'`.
  - Payloads corretamente inferidos em `report`/`fail`/`once`/`on`.
- Mantenha `strict: true`; não use `any`; prefira `unknown` quando necessário.
- Documente os contratos com JSDoc.
