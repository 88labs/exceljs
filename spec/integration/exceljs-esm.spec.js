// Imports the package by name (self-reference through `exports`) to exercise
// what consumers get, rather than lib/ through verquire.
describe('ExcelJS Node ESM import', () => {
  it('exposes the CommonJS API as named exports', async () => {
    const esm = await import('exceljs');
    const cjs = require('exceljs');
    expect(esm.default).to.equal(cjs);
    const named = Object.keys(esm).filter(key => key !== 'default' && key !== 'module.exports');
    expect(named.sort()).to.deep.equal(Object.keys(cjs).sort());
    named.forEach(key => expect(esm[key]).to.equal(cjs[key]));
  });
});
