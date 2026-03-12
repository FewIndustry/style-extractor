import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@extractor': path.resolve(__dirname, './packages/extractor-core/src'),
    },
  },
  test: {
    include: [
      'packages/**/*.test.ts',
      'src/**/*.test.ts',
    ],
  },
})
