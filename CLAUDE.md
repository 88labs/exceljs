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

Build (Grunt pipeline: babel transpile → browserify → terser → exorcise → copy → dist/es5 + dist/exceljs[.bare][.min].js):

```sh
npm run build           # full build
npm run clean-build     # rimraf build/ dist/ then build
```

Lint / format:

```sh
npm run lint            # eslint with eslint-friendly-formatter
npm run lint:fix        # prettier-eslint --write across all .js
```

Tests — multiple suites, all `mocha`-driven (except the browser suite, which is `grunt jasmine`):

```sh
npm test                # full pipeline: build + unit + integration + end-to-end + jasmine (browser)
npm run test:unit       # mocha spec/unit (recursive)
npm run test:integration
npm run test:end-to-end
npm run test:jasmine    # browser, via Grunt; needs prior build
npm run test:dist       # against dist/ bundle
npm run test:typescript # ts-node, against spec/typescript/**/*.spec.ts
```

Run a single test file or pattern:

```sh
npx mocha --require spec/config/setup --require spec/config/setup-unit spec/unit/doc/cell.spec.js
npx mocha --require spec/config/setup spec/integration --recursive --grep "merges"
```

Test against the **ES5 build** (validates `dist/es5/` instead of `lib/` source — runs the build first):

```sh
npm run test:es5
EXCEL_BUILD=es5 npm run test:unit
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
- `lib/exceljs.browser.js` — browser bundle entry **with** `core-js` + `regenerator-runtime` polyfills explicitly required at the top. Add new ES feature → ensure the polyfill list here still covers it.
- `lib/exceljs.bare.js` — browser bundle entry **without** polyfills; consumers bring their own.
- `lib/doc/**` — the domain model (`Workbook`, `Worksheet`, `Row`, `Cell`, `Column`, `Range`, `Image`, `Note`, `Table`, `PivotTable`, `DefinedNames`, `DataValidations`, `ModelContainer`, `Anchor`, `enums`). Each exposes a `.model` getter/setter that round-trips through the Xform layer. See `MODEL.md` for the JSON shape.
- `lib/xlsx/xform/**` — one class per OOXML element/part. Subfolders: `book`, `comment`, `core`, `drawing`, `pivot-table`, `sheet`, `simple`, `strings`, `style`, `table`. `composite-xform.js`, `list-xform.js`, `static-xform.js`, `base-xform.js` are the reusable bases.
- `lib/xlsx/xml/theme1.{js,xml}` — embedded theme XML; treat as static asset.
- `lib/csv/csv.js` — CSV path via `fast-csv`. Exposed as `workbook.csv`.
- `lib/utils/**` — SAX wrapper (`parse-sax.js`), XML stream writer (`xml-stream.js`), zip stream (`zip-stream.js`), `stream-buf.js`, `string-buf.js`, `shared-strings.js`, `shared-formula.js`, `col-cache.js` (A1↔R1C1), `encryptor.js` (sheet protection), `copy-style.js`, `under-dash.js` (tiny lodash subset).
- `dist/` and `build/` are generated. Never hand-edit. `dist/es5/` is the published ES5 build; `dist/exceljs[.bare][.min].js` are browserified bundles.

### Xform contract

Every class under `lib/xlsx/xform/` extends `BaseXform` (`lib/xlsx/xform/base-xform.js`) and implements the read/write contract:

- `prepare(model, options)` — optional pre-write mutation to make the model render-ready (e.g. resolve indexes into the shared strings table).
- `render(xmlStream, model)` — model → XML.
- `parseOpen(node)` / `parseText(text)` / `parseClose(name)` — SAX-event-driven XML → model.
- `reconcile(model, options)` — optional post-parse step, the inverse of `prepare` (e.g. resolve shared-string indexes back to strings).
- `reset()` — clear state so the instance can be reused across parses; if you add child xforms via `this.map`, `BaseXform.reset()` will cascade automatically.

When adding a new XML element: pick the right subfolder under `xform/`, extend `BaseXform` (or `CompositeXform`/`ListXform` for the common cases), and wire it into the parent xform's `map`. Add coverage in `spec/unit/xlsx/xform/...`.

### Tests: the `verquire` indirection

Test files do **not** `require('../../lib/...')` directly. They go through `spec/utils/verquire.js`, which inspects `process.env.EXCEL_BUILD`:

- unset → resolves to `lib/` (source).
- `EXCEL_BUILD=es5` → resolves to `dist/es5/` (the transpiled build) and loads the matching `core-js` polyfills.

So the **same** test suite validates both source and the ES5 build. When adding a test, always import via `verquire` (`global.verquire` is registered in `spec/config/setup.js`) rather than relative `require` into `lib/`. Chai is preloaded as `global.expect` with `chai-xml`, `chai-datetime`, and `dirty-chai`.

There is also a top-level `test/` directory (not `spec/`) containing older script-style tests/manual exercises. These are **not** part of `npm test` — leave them alone unless explicitly asked to run or update them.

## Conventions that bite

- **Node syntax target**: `engines.node` is `^20.19.0 || >=22.12.0`. ESLint enforces `node/no-unsupported-features/es-syntax` at `>=20.19.0` and `excel.js` throws on Node <20.19. Write Node 20+ syntax; the ES5 transpiled build serves browser runtimes (and IE 11 via `dist/es5/` + extra polyfills documented in README).
- **ESLint specifics** (from `.eslintrc`, airbnb-base + prettier + node): single quotes, semicolons required, `max-len: 120` (comments + strings ignored), `arrow-parens: as-needed`, `comma-dangle: always-multiline` **except** for functions (no trailing comma in function arg lists), `no-console` allows only `console.warn`, `object-curly-spacing: never` (`{a, b}` not `{ a, b }`). `**/*.d.ts` is excluded from lint — `index.d.ts` is hand-maintained.
- **Pre-commit**: husky → `lint-staged` runs `prettier-eslint --write` then `eslint` on staged `*.js`. Don't bypass with `--no-verify`.
- **Polyfill bookkeeping**: any new ES feature used in `lib/` must be reachable from `lib/exceljs.browser.js`'s `core-js` requires; if the README's ES5-imports section enumerates polyfills, update it too. The bare browser build (`exceljs.bare.js`) intentionally ships zero polyfills — don't add them there.
- **PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) requires a Summary, a Test plan, and, for typings changes, source-permalink evidence. Follow it.
- **CI matrix**: Node 20/22/24 on Ubuntu and Windows. The Windows jobs disable `core.autocrlf` and enable `core.symlinks` — be mindful of CRLF if a test compares against a fixture XML file under `spec/integration/data/` or `spec/utils/data/`.

## Where to look first

- New feature on the model side → `lib/doc/` and `README.md`'s API section.
- Read/write bug for a specific XML part → `lib/xlsx/xform/<area>/` (e.g. fills → `xform/style/fill-xform.js`; merges → `xform/sheet/merge-cell-xform.js`).
- Large-file or streaming bug → `lib/stream/xlsx/` first, then the relevant xform.
- Object-model shape questions → `MODEL.md`.
- Type surface → `index.d.ts` (and add a case in `spec/typescript/` if behavior is type-visible).
