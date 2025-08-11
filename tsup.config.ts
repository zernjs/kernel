import { defineConfig } from 'tsup';
import { spawn } from 'node:child_process';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true, // Minify para manter o core pequeno
  target: 'es2022',
  outDir: 'dist',
  external: [], // Core sem dependências externas
  treeshake: true, // Tree shaking agressivo
  bundle: true,
  esbuildPlugins: [
    {
      name: 'zern-generate-types-on-rebuild',
      setup(build: { onEnd: (cb: (result: { errors: unknown[] }) => void) => void }): void {
        build.onEnd((result: { errors: unknown[] }) => {
          if ((result.errors ?? []).length === 0) {
            // Gera augmentations a cada rebuild, sem precisar de script dev separado
            const p = spawn(
              process.execPath,
              ['node_modules/tsx/dist/cli.mjs', 'tools/gen-types.mts', '--root', 'examples'],
              {
                stdio: 'ignore',
              }
            );
            p.on('error', () => void 0);
          }
        });
      },
    },
  ],
});
