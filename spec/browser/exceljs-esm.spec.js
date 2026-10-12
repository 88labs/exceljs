import {describe, it, expect} from 'vitest';
import ExcelJS, {Workbook} from '../../dist/exceljs.mjs';

describe('ExcelJS ESM bundle', () => {
  it('should read and write xlsx via named and default exports', async () => {
    const wb = new Workbook();
    wb.addWorksheet('blort').getCell('A1').value = 'Hello, World!';

    const buffer = await wb.xlsx.writeBuffer();
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buffer);
    expect(wb2.getWorksheet('blort').getCell('A1').value).toEqual('Hello, World!');
  });
});
