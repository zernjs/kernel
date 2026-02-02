import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import child_process from 'node:child_process';
import worker_threads from 'node:worker_threads';
import cluster from 'node:cluster';
import dgram from 'node:dgram';
import { createRequire } from 'node:module';
import { SecurityManager } from './manager';
import { PluginManifest } from './types';

// Create a local require function for the host environment
const localRequire = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericFunction = (...args: any[]) => any;

export class PluginSandbox {
  private manager: SecurityManager;

  constructor(manager: SecurityManager) {
    this.manager = manager;
  }

  public load(pluginPath: string, manifest: PluginManifest): unknown {
    const pluginName = manifest.name;
    const permissions = manifest.permissions;
    const pluginDir = path.dirname(pluginPath);

    // 1. Create Proxies for sensitive modules
    const fsProxy = this.createFsProxy(pluginName, permissions);
    const httpProxy = this.createHttpProxy(pluginName, permissions, http);
    const httpsProxy = this.createHttpProxy(pluginName, permissions, https);
    const cpProxy = this.createChildProcessProxy(pluginName, permissions);
    const workerProxy = this.createWorkerProxy(pluginName, permissions);
    const clusterProxy = this.createClusterProxy(pluginName, permissions);
    const dgramProxy = this.createDgramProxy(pluginName, permissions);

    // 2. Create Require Proxy
    const requireProxy = new Proxy(localRequire, {
      apply: (target: typeof localRequire, thisArg: unknown, args: [string]): unknown => {
        const moduleName = args[0];
        // console.log(`[Sandbox] require('${moduleName}')`);

        // Intercept native modules
        // Hardened: fs/promises
        if (moduleName === 'fs' || moduleName === 'node:fs') return fsProxy;
        if (moduleName === 'fs/promises' || moduleName === 'node:fs/promises')
          return fsProxy.promises;

        if (moduleName === 'http' || moduleName === 'node:http') return httpProxy;
        if (moduleName === 'https' || moduleName === 'node:https') return httpsProxy;
        if (moduleName === 'child_process' || moduleName === 'node:child_process') return cpProxy;

        // Hardened: Isolation
        if (moduleName === 'worker_threads' || moduleName === 'node:worker_threads')
          return workerProxy;
        if (moduleName === 'cluster' || moduleName === 'node:cluster') return clusterProxy;
        if (moduleName === 'dgram' || moduleName === 'node:dgram') return dgramProxy;

        // Allow relative imports (files within the plugin)
        if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
          const absPath = localRequire.resolve(moduleName, { paths: [pluginDir] });
          return localRequire(absPath);
        }

        return Reflect.apply(target, thisArg, args);
      },
    });

    // 3. Create Sandbox Context
    const context = vm.createContext({
      require: requireProxy,
      module: { exports: {} },
      exports: {},
      console: console,
      process: this.createProcessProxy(pluginName, permissions),
      Buffer: Buffer,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      // Hardened: Remove dangerous globals
      // eval: undefined,
      // Function: undefined,
      // WebAssembly: undefined,
    });

    // 4. Read and Run Code
    const code = fs.readFileSync(pluginPath, 'utf8');

    // We wrap in a function to mimic CommonJS wrapping
    const wrapper = `(function(exports, require, module, __filename, __dirname) { ${code} \n})`;

    const script = new vm.Script(wrapper, {
      filename: pluginPath,
    });

    const compiledWrapper = script.runInContext(context);

    // Execute
    compiledWrapper.apply(context.exports, [
      context.exports,
      requireProxy,
      context.module,
      pluginPath,
      pluginDir,
    ]);

    return context.module.exports;
  }

  private createFsProxy(pluginName: string, permissions: PluginManifest['permissions']): typeof fs {
    const handler = {
      get: (target: unknown, prop: string | symbol, receiver: unknown): unknown => {
        // Handle 'promises' property specifically
        if (prop === 'promises') {
          return new Proxy(fs.promises, handler); // Recursive proxy for promises
        }

        const original = Reflect.get(target as object, prop, receiver);
        const propStr = String(prop);

        // Intercept methods that read/write files
        const readMethods = [
          'readFile',
          'readFileSync',
          'readdir',
          'readdirSync',
          'stat',
          'statSync',
          'access',
          'accessSync',
          'open', // promises.open
        ];
        const writeMethods = [
          'writeFile',
          'writeFileSync',
          'mkdir',
          'mkdirSync',
          'rm',
          'unlink',
          'appendFile',
        ];

        if (readMethods.includes(propStr)) {
          return (...args: unknown[]): unknown => {
            const pathArg = args[0] as string; // Usually first arg
            if (this.manager.validate(pluginName, permissions, 'filesystem', 'read', pathArg)) {
              return (original as GenericFunction).apply(target, args);
            }
            throw new Error(`[Security] Read access to ${pathArg} denied for ${pluginName}`);
          };
        }

        if (writeMethods.includes(propStr)) {
          return (...args: unknown[]): unknown => {
            const pathArg = args[0] as string;
            if (this.manager.validate(pluginName, permissions, 'filesystem', 'write', pathArg)) {
              return (original as GenericFunction).apply(target, args);
            }
            throw new Error(`[Security] Write access to ${pathArg} denied for ${pluginName}`);
          };
        }

        return original;
      },
    };

    return new Proxy(fs, handler) as typeof fs;
  }

  private createHttpProxy(
    pluginName: string,
    permissions: PluginManifest['permissions'],
    targetModule: typeof http | typeof https
  ): typeof http | typeof https {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Proxy(targetModule as any, {
      get: (
        target: typeof http | typeof https,
        prop: string | symbol,
        receiver: unknown
      ): unknown => {
        const original = Reflect.get(target, prop, receiver);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const URLClass = (globalThis as any).URL;

        if (prop === 'get' || prop === 'request') {
          return (...args: unknown[]): unknown => {
            let url: string = '';
            // Safe casting for checking
            const firstArg = args[0];

            if (typeof firstArg === 'string') url = firstArg;
            else if (firstArg && typeof firstArg === 'object') {
              // Check if it's a URL object or RequestOptions
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const argObj = firstArg as any;

              if (URLClass && argObj instanceof URLClass) url = argObj.hostname;
              else if (argObj.hostname) url = argObj.hostname;
              else if (argObj.host) url = argObj.host;
            }

            if (this.manager.validate(pluginName, permissions, 'network', 'connect', url)) {
              return (original as GenericFunction).apply(target, args);
            }
            throw new Error(`[Security] Network access to ${url} denied for ${pluginName}`);
          };
        }
        return original;
      },
    });
  }

  private createChildProcessProxy(
    pluginName: string,
    permissions: PluginManifest['permissions']
  ): typeof child_process {
    return new Proxy(child_process, {
      get: (
        target: typeof child_process,
        prop: keyof typeof child_process,
        receiver: unknown
      ): unknown => {
        const original = Reflect.get(target, prop, receiver);
        const propStr = String(prop);
        if (['exec', 'spawn', 'execSync', 'spawnSync'].includes(propStr)) {
          return (...args: unknown[]): unknown => {
            if (
              this.manager.validate(pluginName, permissions, 'process', 'spawn', args[0] as string)
            ) {
              return (original as GenericFunction).apply(target, args);
            }
            throw new Error(`[Security] Child Process creation denied for ${pluginName}`);
          };
        }
        return original;
      },
    });
  }

  private createWorkerProxy(
    pluginName: string,
    permissions: PluginManifest['permissions']
  ): typeof worker_threads {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Proxy(worker_threads as any, {
      get: (
        target: typeof worker_threads,
        prop: keyof typeof worker_threads,
        receiver: unknown
      ): unknown => {
        // Block instantiation of Worker check
        if (prop === 'Worker') {
          return new Proxy(target.Worker, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            construct: (targetFn: any, args: any[]): any => {
              if (
                this.manager.validate(
                  pluginName,
                  permissions,
                  'process',
                  'worker',
                  'worker_threads'
                )
              ) {
                return new targetFn(...args);
              }
              throw new Error(`[Security] Worker creation denied for ${pluginName}`);
            },
          });
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  private createClusterProxy(
    pluginName: string,
    permissions: PluginManifest['permissions']
  ): typeof cluster {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Proxy(cluster as any, {
      get: (target: typeof cluster, prop: keyof typeof cluster, receiver: unknown): unknown => {
        const original = Reflect.get(target, prop, receiver);
        if (prop === 'fork') {
          return (...args: unknown[]): unknown => {
            if (this.manager.validate(pluginName, permissions, 'process', 'worker', 'cluster')) {
              return (original as GenericFunction).apply(target, args);
            }
            throw new Error(`[Security] Cluster fork denied for ${pluginName}`);
          };
        }
        return original;
      },
    });
  }

  // Re-implementing simplified worker proxy because the above is a bit messy with mixed modules
  // We will pass the specific target module when calling this.

  private createDgramProxy(
    pluginName: string,
    permissions: PluginManifest['permissions']
  ): typeof dgram {
    return new Proxy(dgram, {
      get: (target: typeof dgram, prop: keyof typeof dgram, receiver: unknown): unknown => {
        const original = Reflect.get(target, prop, receiver);
        if (prop === 'createSocket') {
          return (...args: unknown[]): unknown => {
            if (this.manager.validate(pluginName, permissions, 'network', 'dgram', 'udp')) {
              return (original as GenericFunction).apply(target, args);
            }
            throw new Error(`[Security] UDP Socket creation denied for ${pluginName}`);
          };
        }
        return original;
      },
    });
  }

  private createProcessProxy(
    pluginName: string,
    permissions: PluginManifest['permissions']
  ): typeof process {
    const safeEnv = { ...process.env };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Proxy(process as any, {
      get: (target: typeof process, prop: keyof typeof process, receiver: unknown): unknown => {
        if (prop === 'env') {
          return new Proxy(safeEnv, {
            get: (envTarget: typeof process.env, envKey: string) => {
              if (this.manager.validate(pluginName, permissions, 'env', 'read', envKey)) {
                return envTarget[envKey];
              }
              return undefined;
            },
          });
        }
        if (['exit', 'kill', 'dlopen'].includes(String(prop))) {
          return () => {
            throw new Error(`[Security] process.${String(prop)} is blocked.`);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof process;
  }
}
