import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests unitaires de la version web (le navigateur est simulé par les API de Node : Blob, CompressionStream…).
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  define: { __APP_VERSION__: JSON.stringify('test') },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
