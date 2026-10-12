const nodeCrypto = require('crypto');

const algorithms = ['sha1', 'sha256', 'sha384', 'sha512'];

describe('browser crypto shim', () => {
  let shim;
  before(async () => {
    shim = await import('../../../scripts/browser-crypto-shim.mjs');
  });

  algorithms.forEach(algorithm => {
    it(`hashes ${algorithm} like node:crypto`, () => {
      const data = Buffer.concat([
        Buffer.from('c2FsdA==', 'base64'),
        Buffer.from('pässwörd', 'utf16le'),
      ]);
      const expected = nodeCrypto.createHash(algorithm).update(data).digest();
      const actual = shim.createHash(algorithm.toUpperCase()).update(data).digest();
      expect(Buffer.isBuffer(actual)).to.be.true();
      expect(actual.equals(expected)).to.be.true();
    });
  });

  it('lists the supported algorithms', () => {
    expect(shim.getHashes()).to.deep.equal(algorithms);
  });

  it('generates random bytes', () => {
    const bytes = shim.randomBytes(16);
    expect(Buffer.isBuffer(bytes)).to.be.true();
    expect(bytes.length).to.equal(16);
  });
});
