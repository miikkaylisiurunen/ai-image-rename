import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs'],
  platform: 'node',
  dts: false,
  splitting: false,
  clean: true,
  bundle: true,
  treeshake: true,
  minify: true,
  noExternal: [/.*/],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
