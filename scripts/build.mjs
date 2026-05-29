import * as esbuild from 'esbuild';
import {copyFile, rm, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// esbuild does not auto-shim Node built-ins for browser bundles the way
// browserify did. Map the ones reachable from the browser entry to either an
// empty stub (fs — only used by Node-only filesystem helpers) or to the
// equivalent browserify-era polyfill packages.
const fsStubPath = resolve(repoRoot, 'build/empty-fs-stub.cjs');

async function build() {
  await rm(resolve(repoRoot, 'build'), {recursive: true, force: true});
  await rm(resolve(repoRoot, 'dist'), {recursive: true, force: true});

  await mkdir(dirname(fsStubPath), {recursive: true});
  await writeFile(
    fsStubPath,
    '// empty fs shim for browser bundles — matches the historical browserify behavior\nmodule.exports = {};\n'
  );

  const sharedOptions = {
    bundle: true,
    format: 'iife',
    globalName: 'ExcelJS',
    platform: 'browser',
    sourcemap: 'linked',
    target: 'es2020',
    alias: {
      fs: fsStubPath,
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      // Route `require('stream')` to the same `readable-stream` the rest of
      // lib/ (and fast-csv) already depends on — keeps one stream
      // implementation in the bundle instead of stream-browserify's nested,
      // broken older readable-stream copy.
      stream: 'readable-stream',
      util: 'util',
    },
    // browserify auto-injected `global` and `process` for browser bundles;
    // esbuild does not. Map them to globalThis / a minimal shim so transitive
    // deps like randombytes / readable-stream don't ReferenceError at init.
    define: {
      global: 'globalThis',
      'process.env.NODE_ENV': '"production"',
    },
    inject: [resolve(repoRoot, 'scripts/browser-process-shim.mjs')],
  };

  await Promise.all([
    esbuild.build({
      ...sharedOptions,
      entryPoints: [resolve(repoRoot, 'lib/exceljs.bare.js')],
      outfile: resolve(repoRoot, 'dist/exceljs.bare.js'),
    }),
    esbuild.build({
      ...sharedOptions,
      entryPoints: [resolve(repoRoot, 'lib/exceljs.browser.js')],
      outfile: resolve(repoRoot, 'dist/exceljs.js'),
    }),
    esbuild.build({
      ...sharedOptions,
      entryPoints: [resolve(repoRoot, 'lib/exceljs.bare.js')],
      outfile: resolve(repoRoot, 'dist/exceljs.bare.min.js'),
      minify: true,
    }),
    esbuild.build({
      ...sharedOptions,
      entryPoints: [resolve(repoRoot, 'lib/exceljs.browser.js')],
      outfile: resolve(repoRoot, 'dist/exceljs.min.js'),
      minify: true,
    }),
  ]);

  await copyFile(resolve(repoRoot, 'LICENSE'), resolve(repoRoot, 'dist/LICENSE'));
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
