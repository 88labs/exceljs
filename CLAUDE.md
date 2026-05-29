# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository context

This is the **88labs fork** of [exceljs/exceljs](https://github.com/exceljs/exceljs) — a Node + browser library for reading, manipulating, and writing XLSX/CSV. `package.json` `author`/`repository` still point upstream; do not "fix" them. The README badge also points upstream. CI uses `flatt-security/setup-takumi-guard-npm` (88labs bot) to gate npm installs.

User-facing API surface and behavior are documented in `README.md` (very large — grep it) and `MODEL.md` (object-model shapes). `index.d.ts` is the **sole** TypeScript declaration file and is validated by CI with `tsc index.d.ts --ignoreConfig --types node`.

## Commands

Install (CI retries up to 3× to ride out flaky registries):

```sh
npm install
```

Build (esbuild pipeline: bundles `lib/exceljs.browser.js` and `lib/exceljs.bare.js` as IIFE/ES2020 → dist/exceljs[.bare][.min].js + sourcemaps + LICENSE):

```sh
npm run build           # full build via scripts/build.mjs
npm run clean-build     # alias of build (clears dist/ and build/ as part of the script)
npm run clean           # rimraf build/ dist/ only
```

Lint / format:

```sh
npm run lint       # oxlint
npm run lint:fix   # oxfmt + oxlint --fix
```

Tests — node suites use `mocha`; the browser suite is Vitest + Playwright/Chromium:

```sh
npm test                # unit + integration + end-to-end + browser (vitest) + dist + typescript
npm run test:unit       # mocha spec/unit (recursive)
npm run test:integration
npm run test:end-to-end
npm run test:browser    # vitest + Playwright/Chromium; requires Chromium installed (see below)
npm run test:dist       # against dist/ bundle (run `npm run build` first)
npm run test:typescript # ts-node, against spec/typescript/**/*.spec.ts
```

Before the first `npm run test:browser`, install Playwright's Chromium:

```sh
npx playwright install chromium --with-deps
```

Run a single test file or pattern:

```sh
npx mocha --require spec/config/setup --require spec/config/setup-unit spec/unit/doc/cell.spec.js
npx mocha --require spec/config/setup spec/integration --recursive --grep "merges"
```

Benchmark (do not commit benchmark output):

```sh
npm run benchmark
```

## Architecture

### Two parallel I/O paths — both must be kept in sync

ExcelJS exposes **two independent code paths** for XLSX I/O. A behavior change in one almost always needs the matching change in the other; pick which path the bug or feature lives in before editing.

1. **In-memory path** — `workbook.xlsx.readFile/writeFile/load/write`
   - Entry: `lib/xlsx/xlsx.js`
   - Uses `jszip` (read) and `archiver` (write) to handle the OOXML container.
   - Each XML part is parsed/rendered through an **Xform** class (see "Xform contract" below).
   - Suitable for small/medium workbooks where the full model fits in memory.

2. **Streaming path** — `ExcelJS.stream.xlsx.WorkbookWriter` / `WorkbookReader`
   - Entry: `lib/stream/xlsx/{workbook,worksheet}-{reader,writer}.js`
   - Writer streams rows directly to a zip stream (`lib/utils/zip-stream.js`); reader uses `unzipper` + `saxes` (`lib/utils/parse-sax.js`).
   - Suitable for large workbooks; behavior diverges from the in-memory path in subtle ways (e.g. shared strings, formula resolution timing).

Bug reports that mention "stream" or "large file" → streaming path. Plain `workbook.xlsx.*` → in-memory path.

### Source layout

- `excel.js` — top-level entry; node-version check then `require('./lib/exceljs.nodejs.js')`.
- `lib/exceljs.nodejs.js` — Node entry. Exports `Workbook`, `ModelContainer`, `stream.xlsx.{WorkbookWriter,WorkbookReader}`, and all enums.
- `lib/exceljs.browser.js` — browser bundle entry; now a thin re-export of `./exceljs.bare.js` (polyfills removed since the build targets ES2020). Kept as a separate entry so consumers pinning `dist/exceljs.js` keep working.
- `lib/exceljs.bare.js` — browser bundle entry **without** polyfills; consumers bring their own.
- `lib/doc/**` — the domain model (`Workbook`, `Worksheet`, `Row`, `Cell`, `Column`, `Range`, `Image`, `Note`, `Table`, `PivotTable`, `DefinedNames`, `DataValidations`, `ModelContainer`, `Anchor`, `enums`). Each exposes a `.model` getter/setter that round-trips through the Xform layer. See `MODEL.md` for the JSON shape.
- `lib/xlsx/xform/**` — one class per OOXML element/part. Subfolders: `book`, `comment`, `core`, `drawing`, `pivot-table`, `sheet`, `simple`, `strings`, `style`, `table`. `composite-xform.js`, `list-xform.js`, `static-xform.js`, `base-xform.js` are the reusable bases.
- `lib/xlsx/xml/theme1.{js,xml}` — embedded theme XML; treat as static asset.
- `lib/csv/csv.js` — CSV path via `fast-csv`. Exposed as `workbook.csv`.
- `lib/utils/**` — SAX wrapper (`parse-sax.js`), XML stream writer (`xml-stream.js`), zip stream (`zip-stream.js`), `stream-buf.js`, `string-buf.js`, `shared-strings.js`, `shared-formula.js`, `col-cache.js` (A1↔R1C1), `encryptor.js` (sheet protection), `copy-style.js`, `under-dash.js` (tiny lodash subset).
- `dist/` and `build/` are generated. Never hand-edit. `dist/exceljs[.bare][.min].js` (+ `.map`) are the esbuild IIFE bundles published to consumers. There is no longer a `dist/es5/` (the Babel/ES5 surface was removed alongside the Grunt pipeline).

### Xform contract

Every class under `lib/xlsx/xform/` extends `BaseXform` (`lib/xlsx/xform/base-xform.js`) and implements the read/write contract:

- `prepare(model, options)` — optional pre-write mutation to make the model render-ready (e.g. resolve indexes into the shared strings table).
- `render(xmlStream, model)` — model → XML.
- `parseOpen(node)` / `parseText(text)` / `parseClose(name)` — SAX-event-driven XML → model.
- `reconcile(model, options)` — optional post-parse step, the inverse of `prepare` (e.g. resolve shared-string indexes back to strings).
- `reset()` — clear state so the instance can be reused across parses; if you add child xforms via `this.map`, `BaseXform.reset()` will cascade automatically.

When adding a new XML element: pick the right subfolder under `xform/`, extend `BaseXform` (or `CompositeXform`/`ListXform` for the common cases), and wire it into the parent xform's `map`. Add coverage in `spec/unit/xlsx/xform/...`.

### Tests: the `verquire` indirection

Test files do **not** `require('../../lib/...')` directly. They go through `spec/utils/verquire.js`, which always resolves to `lib/` (source). The wrapper used to also support `EXCEL_BUILD=es5` to validate the transpiled build; that branch was removed when the ES5 output was retired.

When adding a test, always import via `verquire` (`global.verquire` is registered in `spec/config/setup.js`) rather than relative `require` into `lib/`. Chai is preloaded as `global.expect` with `chai-xml`, `chai-datetime`, and `dirty-chai`.

There is also a top-level `test/` directory (not `spec/`) containing older script-style tests/manual exercises. These are **not** part of `npm test` — leave them alone unless explicitly asked to run or update them.

## Conventions that bite

- **Node syntax target**: `engines.node` is `^20.19.0 || >=22.12.0`. ESLint enforces `node/no-unsupported-features/es-syntax` at `>=20.19.0` and `excel.js` throws on Node <20.19. Write Node 20+ syntax; the browser bundle targets ES2020 via esbuild (no more Babel/ES5 fallback — older browsers including IE 11 are no longer supported).
- **Lint/format tooling** (from `.oxlintrc.json`): oxlint for correctness + suspicious categories. Project-specific rules: single quotes, semicolons required, `no-console` allows only `console.warn`, `no-unused-vars` (vars: all, args: none), `no-use-before-define` (variables/classes/functions: false). `max-len:120` is not in oxlint scope (follow-up if needed). `**/*.d.ts` is excluded from lint — `index.d.ts` is hand-maintained. Formatting (including trailing whitespace) is handled by oxfmt. Note: `for...in` is not used in `lib/` (grep confirms), so `no-restricted-syntax` is not needed; `no-trailing-spaces` is not an oxlint rule — oxfmt handles trailing whitespace instead.
- **Pre-commit**: husky → `lint-staged` runs `oxfmt` then `oxlint --fix` on staged `*.{js,ts}`. Don't bypass with `--no-verify`.
- **Polyfill bookkeeping**: the bundle targets ES2020 (esbuild `target: 'es2020'`) and ships no polyfills. Consumers needing older runtimes bring their own. Don't reintroduce `core-js` / `regenerator-runtime`.
- **PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) requires a Summary, a Test plan, and, for typings changes, source-permalink evidence. Follow it.
- **CI matrix**: Node 20/22/24 on Ubuntu and Windows. The Windows jobs disable `core.autocrlf` and enable `core.symlinks` — be mindful of CRLF if a test compares against a fixture XML file under `spec/integration/data/` or `spec/utils/data/`.

## Where to look first

- New feature on the model side → `lib/doc/` and `README.md`'s API section.
- Read/write bug for a specific XML part → `lib/xlsx/xform/<area>/` (e.g. fills → `xform/style/fill-xform.js`; merges → `xform/sheet/merge-cell-xform.js`).
- Large-file or streaming bug → `lib/stream/xlsx/` first, then the relevant xform.
- Object-model shape questions → `MODEL.md`.
- Type surface → `index.d.ts` (and add a case in `spec/typescript/` if behavior is type-visible).
