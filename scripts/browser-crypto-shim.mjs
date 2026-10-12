// `crypto` replacement for the browser bundle. lib/ only uses createHash and
// getHashes (sheet-protection password hashing) and randomBytes (its salt).
// Web Crypto can't back createHash because `protect()` hashes synchronously,
// so hashing uses @noble/hashes.

import {Buffer} from 'buffer';
import {sha1} from '@noble/hashes/legacy.js';
import {sha256, sha384, sha512} from '@noble/hashes/sha2.js';

const hashes = {sha1, sha256, sha384, sha512};

export function getHashes() {
  return Object.keys(hashes);
}

export function createHash(algorithm) {
  const hash = hashes[algorithm.toLowerCase()];
  if (!hash) {
    throw new Error(`Hash algorithm '${algorithm}' not supported!`);
  }
  const state = hash.create();
  return {
    update(data) {
      state.update(data);
      return this;
    },
    digest() {
      return Buffer.from(state.digest());
    },
  };
}

export function randomBytes(size) {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(size)));
}
