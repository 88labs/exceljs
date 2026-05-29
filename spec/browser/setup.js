// Load the pre-built IIFE bundle and expose ExcelJS on globalThis for the
// browser spec. The spec runs in a Vite/Vitest browser environment which is
// ESM-first; the lib/ source is CommonJS, so we use the pre-built bundle
// (produced by `npm run build`) instead of importing the source directly.
import {beforeAll} from 'vitest';
import bundleUrl from '../../dist/exceljs.bare.js?url';

beforeAll(
  () =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = bundleUrl;
      script.onload = resolve;
      script.onerror = () =>
        reject(
          new Error(
            'Failed to load dist/exceljs.bare.js — run `npm run build` first'
          )
        );
      document.head.appendChild(script);
    })
);
