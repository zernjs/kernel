/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-object-type */

import { KernelBuilder } from './kernel';

/**
 * Tipos utilitários para o Zern Kernel.
 * Focados em inferência e manipulação de objetos profundos.
 */

// Simplifica a exibição de tipos no editor
export type Simplify<T> = { [K in keyof T]: T[K] } & {};

// Converte União para Interseção (Union to Intersection)
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// Merge raso
export type Merge<A, B> = Simplify<Omit<A, keyof B> & B>;

// Merge profundo para augmentation
export type DeepMerge<T, U> = T extends object
  ? U extends object
    ? Simplify<{
        [K in keyof T | keyof U]: K extends keyof T
          ? K extends keyof U
            ? DeepMerge<T[K], U[K]>
            : T[K]
          : K extends keyof U
            ? U[K]
            : never;
      }>
    : U
  : U;

// Tipo base para qualquer API de plugin
export type AnyPluginAPI = Record<string, any>;

// Definição de Middleware Genérico
// Adicionando 'any' como padrão para os argumentos para facilitar a inferência quando não usados
export type MiddlewareFn = (next: (...args: any[]) => any, ...args: any[]) => any;

// Mapa de Middlewares Genérico
export type MiddlewareMap = Record<string, Record<string, MiddlewareFn>>;

// --- Tipos para Inferência de Middlewares ---

// Extrai o tipo de middleware tipado para uma função específica
// Permite que os argumentos sejam opcionais na implementação do middleware
// A tipagem 'any' nos argumentos é necessária para permitir omissão sem erros de tipo,
// mas a inferência contextual (next, a, b) continuará funcionando se os nomes baterem.
export type TypedMiddlewareFor<F> = F extends (...args: infer Args) => infer Return
  ? (next: (...args: Args) => Return, ...args: Args) => Return
  : never;

// Mapeia uma API de plugin para seus respectivos middlewares tipados
export type PluginMiddlewares<API> = {
  [K in keyof API]?: TypedMiddlewareFor<API[K]>;
};

// Mapeia todas as dependências (Contexto) para seus middlewares
// Usamos Required<Context> para garantir que plugins opcionais não atrapalhem a inferência de middlewares
export type MiddlewaresForContext<Context> = {
  [PluginName in keyof Context]?: PluginMiddlewares<Exclude<Context[PluginName], undefined | null>>;
};

// --- Fim Tipos de Middleware ---

// Definição de Dependência (Nome e Versão opcional, mas aqui focamos em runtime references)
export type PluginDependency =
  | PluginDefinition<any, any, any, any>
  | { plugin: PluginDefinition<any, any, any, any>; range: string }
  | readonly PluginDependency[]; // Suporte recursivo para arrays aninhados (comum em setups complexos)

// Extrai o tipo de API de um plugin
export type InferPluginAPI<T> =
  T extends PluginDefinition<infer _Name, infer API, infer _Aug, infer _Deps> ? API : never;

// Extrai o tipo de Augmentation de um plugin
export type InferPluginAugmentations<T> =
  T extends PluginDefinition<infer _Name, infer _API, infer Aug, infer _Deps> ? Aug : never;

// Extrai o tipo de plugin de uma dependência (seja objeto ou direto)
export type UnwrapDependency<T> =
  T extends PluginDefinition<any, any, any, any>
    ? T
    : T extends { plugin: infer P }
      ? P
      : T extends readonly (infer U)[] // Unwrap recursivo para arrays
        ? UnwrapDependency<U>
        : never;

// Helper para extrair tipos de plugins de forma distributiva
// Isso garante que cada membro de uma união (ex: PluginA | PluginB) seja processado individualmente
export type DistributePluginAPI<D> =
  D extends PluginDefinition<infer Name, infer API, infer _Aug, infer _Deps>
    ? { [K in Name]: API }
    : never;

// Mapeia um array de dependências para um objeto de contexto unificado
export type DependenciesMap<Deps extends readonly PluginDependency[]> = UnionToIntersection<
  DistributePluginAPI<UnwrapDependency<Deps[number]>>
>;

// Contexto passado para o setup do plugin
export interface PluginContext<GlobalContext = any> {
  plugins: GlobalContext;
}

// Extrai o Contexto de um KernelBuilder
export type InferKernelContext<T> = T extends KernelBuilder<infer C> ? C : never;

// Definição do Plugin (Runtime + Types)
export interface PluginDefinition<
  Name extends string,
  API extends AnyPluginAPI,
  Augmentations extends Record<string, any> = {},
  Dependencies extends readonly PluginDependency[] = [],
> {
  name: Name;
  version: string;
  // O contexto do setup agora infere o tipo das dependências
  setup: (ctx: PluginContext<DependenciesMap<Dependencies>>) => API | Promise<API>;
  // Setup de versões específicas (para uso futuro ou manual)
  apiVersions?: Record<
    string,
    (ctx: PluginContext<DependenciesMap<Dependencies>>) => API | Promise<API>
  >;
  dependencies?: Dependencies;
  // Propriedade fantasma para carregar o tipo de augmentation
  __augmentations?: Augmentations;
}
