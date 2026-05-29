import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    include: ['spec/browser/**/*.spec.js'],
    setupFiles: ['spec/browser/setup.js'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{browser: 'chromium'}],
      headless: true,
    },
  },
});
