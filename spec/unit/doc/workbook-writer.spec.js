const Stream = require('readable-stream');

const Excel = verquire('exceljs');

describe('Workbook Writer', () => {
  it('returns undefined for non-existant sheet', () => {
    const stream = new Stream.Writable({
      write: function noop() {},
    });
    const wb = new Excel.stream.xlsx.WorkbookWriter({
      stream,
    });
    wb.addWorksheet('first');
    expect(wb.getWorksheet('w00t')).to.equal(undefined);
  });

  it('forwards zip entry stream errors to the archive', () => {
    const stream = new Stream.Writable({
      write: function noop() {},
    });
    const wb = new Excel.stream.xlsx.WorkbookWriter({
      stream,
    });
    let entry;
    const append = wb.zip.append.bind(wb.zip);
    wb.zip.append = (source, data) => {
      entry = source;
      return append(source, data);
    };
    wb._openStream('/xl/test.xml');

    const errors = [];
    wb.zip.on('error', err => errors.push(err));
    const error = new Error('entry failed');
    entry.emit('error', error);
    expect(errors).to.deep.equal([error]);
  });
});
