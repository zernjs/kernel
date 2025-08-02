import { defineConfig } from 'tsup';
import { resolve } from 'node:path';

export default defineConfig({
  entry: [resolve(__dirname, 'src/index.ts')],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2022',
  outDir: resolve(__dirname, 'dist'),
  tsconfig: resolve(__dirname, './tooling/tsconfig.build.json'),
  external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata', 'rxjs'],
});
