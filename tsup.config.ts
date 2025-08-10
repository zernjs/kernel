import { defineConfig } from 'tsup';

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
});
