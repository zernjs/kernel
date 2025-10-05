/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PluginId } from '@/core';

export interface ProxyContext<TMethod extends (...args: any[]) => any, TStore = any> {
  readonly plugin: string;
  readonly method: string;
  readonly args: Parameters<TMethod>;

  _skipExecution?: boolean;
  _overrideResult?: Awaited<ReturnType<TMethod>>;
  _modifiedArgs?: Parameters<TMethod>;

  readonly store: TStore;

  skip: () => void;
  replace: (result: Awaited<ReturnType<TMethod>>) => void;
  modifyArgs: (...args: Parameters<TMethod>) => void;
}

export type ProxyBefore<TMethod extends (...args: any[]) => any, TStore = any> = (
  ctx: ProxyContext<TMethod, TStore>
) => void | Promise<void>;

export type ProxyAfter<TMethod extends (...args: any[]) => any, TStore = any> = (
  result: Awaited<ReturnType<TMethod>>,
  ctx: ProxyContext<TMethod, TStore>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>>;

export type ProxyError<TMethod extends (...args: any[]) => any, TStore = any> = (
  error: Error,
  ctx: ProxyContext<TMethod, TStore>
) => Awaited<ReturnType<TMethod>> | Promise<Awaited<ReturnType<TMethod>>> | never;

export type ProxyAround<TMethod extends (...args: any[]) => any, TStore = any> = (
  ctx: ProxyContext<TMethod, TStore>,
  next: () => Promise<Awaited<ReturnType<TMethod>>>
) => Promise<Awaited<ReturnType<TMethod>>>;

export type MethodPattern = string | RegExp;

export interface ProxyConfig<TStore = any> {
  include?: MethodPattern[];
  exclude?: MethodPattern[];

  before?: ProxyBefore<any, TStore>;
  after?: ProxyAfter<any, TStore>;
  onError?: ProxyError<any, TStore>;
  around?: ProxyAround<any, TStore>;

  priority?: number;
  condition?: (ctx: ProxyContext<any, TStore>) => boolean;
  group?: string;
}

export type ProxyTarget = PluginId | 'self' | '*' | '**';

export interface ProxyMetadata {
  readonly targetPluginId: ProxyTarget;
  readonly config: ProxyConfig<any>;
}

export interface CompiledMethodProxy {
  readonly targetPluginId: PluginId;
  readonly methodName: string;
  readonly before?: ProxyBefore<any>;
  readonly after?: ProxyAfter<any>;
  readonly onError?: ProxyError<any>;
  readonly around?: ProxyAround<any>;
  readonly priority: number;
  readonly condition?: (ctx: ProxyContext<any>) => boolean;
  readonly group?: string;
}

export type ExtractMethodNames<TPlugin> = {
  [K in keyof TPlugin]: TPlugin[K] extends (...args: any[]) => any ? K : never;
}[keyof TPlugin];

export function matchesPattern(methodName: string, pattern: MethodPattern): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(methodName);
  }

  const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(methodName);
}

export function shouldProxyMethod(methodName: string, config: ProxyConfig): boolean {
  if (config.include && config.include.length > 0) {
    const included = config.include.some((pattern: MethodPattern) =>
      matchesPattern(methodName, pattern)
    );
    if (!included) return false;
  }

  if (config.exclude && config.exclude.length > 0) {
    const excluded = config.exclude.some((pattern: MethodPattern) =>
      matchesPattern(methodName, pattern)
    );
    if (excluded) return false;
  }

  return true;
}

export function skipExecution<TStore = any>(ctx: ProxyContext<any, TStore>): void {
  ctx._skipExecution = true;
}

export function replaceResult<T, TStore = any>(ctx: ProxyContext<any, TStore>, result: T): void {
  ctx._skipExecution = true;
  ctx._overrideResult = result;
}

export function modifyArgs<TMethod extends (...args: any[]) => any, TStore = any>(
  ctx: ProxyContext<TMethod, TStore>,
  ...newArgs: Parameters<TMethod>
): void {
  ctx._modifiedArgs = newArgs;
}

export function enhanceContext<
  TMethod extends (...args: any[]) => any,
  TStore = Record<string, never>,
>(ctx: ProxyContext<TMethod, TStore>): ProxyContext<TMethod, TStore> {
  (ctx as any).skip = (): void => skipExecution(ctx);
  (ctx as any).replace = (result: Awaited<ReturnType<TMethod>>): void => replaceResult(ctx, result);
  (ctx as any).modifyArgs = (...args: Parameters<TMethod>): void => modifyArgs(ctx, ...args);

  return ctx;
}
