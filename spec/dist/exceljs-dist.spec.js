const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');

const pkg = require('../../package.json');

const root = path.resolve(__dirname, '../..');
const exists = file => new Promise(resolve => fs.exists(path.resolve(root, file), resolve));

describe('ExcelJS', () => {
  describe('dist folder', () => {
    it('should include LICENSE', async () => {
      expect(await exists('dist/LICENSE')).to.be.true();
    });
    it('should include exceljs.js', async () => {
      expect(await exists('dist/exceljs.js')).to.be.true();
    });
    it('should include exceljs.min.js', async () => {
      expect(await exists('dist/exceljs.min.js')).to.be.true();
    });
    it('should include exceljs.mjs', async () => {
      expect(await exists('dist/exceljs.mjs')).to.be.true();
    });
  });

  describe('browser export', () => {
    it('resolves to a built file', async () => {
      expect(await exists(pkg.exports['.'].browser)).to.be.true();
    });

    it('exposes the API as both default and named exports', async () => {
      const mod = await import(pathToFileURL(path.resolve(root, pkg.exports['.'].browser)).href);
      expect(mod.default.Workbook).to.be.a('function');
      const named = Object.keys(mod).filter(key => key !== 'default');
      expect(named.sort()).to.deep.equal(Object.keys(mod.default).sort());
      named.forEach(key => expect(mod[key]).to.equal(mod.default[key]));
    });
  });
});
