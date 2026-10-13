import { randomBytes } from 'node:crypto';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig(({ command }) => {
  const nonce = command === 'serve' ? randomBytes(18).toString('base64') : undefined;
  return {
    base: './',
    html: { cspNonce: nonce },
    plugins: [
      react(),
      tailwind(),
      {
        name: 'studyroom-development-csp',
        transformIndexHtml(html) {
          return nonce
            ? html.replace("script-src 'self'", "script-src 'self' 'nonce-" + nonce + "'")
            : html;
        },
      },
    ],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
