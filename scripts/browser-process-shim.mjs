// Minimal `process` and `Buffer` shims for the browser bundle. browserify
// auto-injected these (via the `process` and `buffer` npm packages); esbuild
// does not. Most transitive deps only use `process.nextTick`,
// `process.env.NODE_ENV`, `process.browser`, and `Buffer.from` / `Buffer.alloc`.

import {Buffer as BufferShim} from 'buffer';

const noop = () => {};

const browserProcess = {
  env: {NODE_ENV: 'production'},
  browser: true,
  version: '',
  versions: {},
  argv: [],
  nextTick(fn) {
    Promise.resolve().then(fn);
  },
  cwd: () => '/',
  chdir: noop,
  on: noop,
  off: noop,
  once: noop,
  removeListener: noop,
  emit: noop,
  listeners: () => [],
  binding() {
    throw new Error('process.binding is not supported in browsers');
  },
};

export {browserProcess as process, BufferShim as Buffer};
